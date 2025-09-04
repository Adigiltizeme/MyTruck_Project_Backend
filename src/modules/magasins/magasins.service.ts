import { Injectable, NotFoundException, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMagasinDto, UpdateMagasinDto, UpdateMagasinPasswordDto, GenerateMagasinPasswordDto } from './dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class MagasinsService {
    private readonly logger = new Logger(MagasinsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(filters: {
        skip?: number;
        take?: number;
        status?: string;
    }) {
        const { skip, take, status } = filters;

        // Construction du filtre where (même logique que chauffeurs)
        const where: any = {};
        if (status) {
            where.status = status;
        }

        const magasins = await this.prisma.magasin.findMany({
            where,
            skip: skip || 0,
            take: take || 50,
            orderBy: { nom: 'asc' },
            include: {
                _count: {
                    select: {
                        users: true,
                        commandes: true,
                    },
                },
            },
        });

        this.logger.log(`✅ ${magasins.length} magasins récupérés`);
        return magasins;
    }

    async findOne(id: string) {
        const magasin = await this.prisma.magasin.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        nom: true,
                        prenom: true,
                        email: true,
                        role: true,
                        status: true,
                    },
                },
                _count: {
                    select: {
                        commandes: true,
                        factures: true,
                        devis: true,
                    },
                },
            },
        });

        if (!magasin) {
            throw new NotFoundException(`Magasin avec l'ID ${id} non trouvé`);
        }

        this.logger.log(`✅ Magasin récupéré: ${magasin.nom}`);
        return magasin;
    }

    async create(createMagasinDto: CreateMagasinDto) {
        const { managerPassword, ...magasinData } = createMagasinDto;
        
        // Générer l'email si non fourni
        if (!magasinData.email) {
            const nomNormalized = magasinData.nom.toLowerCase().replace(/[^a-z0-9]/g, '');
            magasinData.email = `${nomNormalized}@mytruck.com`;
        }

        // Générer un mot de passe par défaut si pas fourni
        const defaultPassword = managerPassword || this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        const magasin = await this.prisma.magasin.create({
            data: {
                ...magasinData,
                categories: createMagasinDto.categories || [],
                password: hashedPassword,
                hasAccount: true,
                accountStatus: 'active',
            },
            include: {
                _count: {
                    select: {
                        users: true,
                        commandes: true,
                    },
                },
            },
        });

        this.logger.log(`✅ Magasin créé avec compte utilisateur: ${magasin.nom} (${magasin.id})`);
        if (!managerPassword) {
            this.logger.log(`🔑 Mot de passe généré: ${defaultPassword}`);
        }
        
        return {
            ...magasin,
            temporaryPassword: !managerPassword ? defaultPassword : undefined,
        };
    }

    async createOrUpdateAccount(id: string, accountDto: any) {
        const magasin = await this.findOne(id);

        let password = accountDto.password;
        if (accountDto.generatePassword) {
            password = this.generateRandomPassword();
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const updatedMagasin = await this.prisma.magasin.update({
            where: { id },
            data: {
                email: accountDto.email,
                password: hashedPassword,
                hasAccount: true,
                accountStatus: 'active'
            }
        });

        return {
            message: 'Compte utilisateur créé/mis à jour',
            temporaryPassword: accountDto.generatePassword ? password : undefined
        };
    }

    private generateRandomPassword(): string {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 12; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        };
        return password;
    }

    async updateProfile(id: string, updateData: any) {
        return this.prisma.magasin.update({
            where: { id },
            data: {
                nom: updateData.nom,
                email: updateData.email,
                telephone: updateData.telephone,
                updatedAt: new Date()
            }
        });
    }

    async changePassword(id: string, passwordData: any) {
        const magasin = await this.prisma.magasin.findUnique({
            where: { id },
            select: { password: true }
        });

        if (!magasin.password) {
            throw new BadRequestException('Aucun compte utilisateur configuré');
        }

        const isCurrentPasswordValid = await bcrypt.compare(
            passwordData.currentPassword,
            magasin.password
        );

        if (!isCurrentPasswordValid) {
            throw new UnauthorizedException('Mot de passe actuel incorrect');
        }

        const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, 12);

        await this.prisma.magasin.update({
            where: { id },
            data: { password: hashedNewPassword }
        });

        return { message: 'Mot de passe modifié avec succès' };
    }

    async updatePassword(id: string, updatePasswordDto: UpdateMagasinPasswordDto) {
        const magasin = await this.findOne(id);
        const hashedPassword = await bcrypt.hash(updatePasswordDto.password, 12);

        await this.prisma.magasin.update({
            where: { id },
            data: { 
                password: hashedPassword,
                hasAccount: true,
                accountStatus: 'active'
            }
        });

        this.logger.log(`✅ Mot de passe mis à jour pour le magasin: ${magasin.nom}`);
        return { message: 'Mot de passe mis à jour avec succès' };
    }

    async generateNewPassword(id: string, options?: GenerateMagasinPasswordDto) {
        const magasin = await this.findOne(id);
        const newPassword = this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await this.prisma.magasin.update({
            where: { id },
            data: { 
                password: hashedPassword,
                hasAccount: true,
                accountStatus: 'active'
            }
        });

        this.logger.log(`✅ Nouveau mot de passe généré pour: ${magasin.nom}`);
        return {
            message: 'Nouveau mot de passe généré avec succès',
            temporaryPassword: newPassword
        };
    }

    async syncUserProfile(id: string) {
        const magasin = await this.findOne(id);
        
        // Les données du magasin sont déjà dans le bon modèle, pas besoin de synchronisation séparée
        this.logger.log(`✅ Profil magasin déjà synchronisé: ${magasin.nom}`);
        return { message: 'Profil magasin déjà synchronisé' };
    }

    async update(id: string, updateMagasinDto: UpdateMagasinDto) {
        // Vérifier que le magasin existe (même logique que chauffeurs)
        await this.findOne(id);

        const magasin = await this.prisma.magasin.update({
            where: { id },
            data: updateMagasinDto,
            include: {
                _count: {
                    select: {
                        users: true,
                        commandes: true,
                    },
                },
            },
        });

        this.logger.log(`✅ Magasin mis à jour: ${magasin.nom} (${magasin.id})`);
        return magasin;
    }

    async remove(id: string, forceDelete: boolean = false) {
        const existingMagasin = await this.findOne(id);

        if (!forceDelete) {
            // Vérifier qu'il n'y a pas de dépendances critiques (logique existante)
            const dependencies = await this.prisma.magasin.findUnique({
                where: { id },
                include: {
                    _count: {
                        select: {
                            users: true,
                            commandes: true,
                            factures: true,
                            devis: true,
                        },
                    },
                },
            });

            const totalDependencies =
                dependencies._count.users +
                dependencies._count.commandes +
                dependencies._count.factures +
                dependencies._count.devis;

            if (totalDependencies > 0) {
                // Utiliser BadRequestException au lieu de Error pour avoir un status 400
                const errorMessage = `Impossible de supprimer le magasin car il contient des données liées (${totalDependencies} éléments)`;
                this.logger.warn(`⚠️ ${errorMessage}`);
                throw new BadRequestException(errorMessage);
            }
        } else {
            // SUPPRESSION FORCÉE - Nettoyer les dépendances avant suppression
            this.logger.warn(`🚨 SUPPRESSION FORCÉE du magasin: ${existingMagasin.nom}`);

            await this.prisma.$transaction(async (tx) => {
                // 1. Supprimer d'abord tous les éléments liés aux commandes
                const commandes = await tx.commande.findMany({
                    where: { magasinId: id },
                    select: { id: true }
                });

                for (const commande of commandes) {
                    // Supprimer les articles liés aux commandes
                    await tx.article.deleteMany({
                        where: { commandeId: commande.id }
                    });

                    // Supprimer les assignations chauffeurs
                    await tx.chauffeurSurCommande.deleteMany({
                        where: { commandeId: commande.id }
                    });

                    // Supprimer les rapports
                    await tx.rapportEnlevement.deleteMany({
                        where: { commandeId: commande.id }
                    });

                    await tx.rapportLivraison.deleteMany({
                        where: { commandeId: commande.id }
                    });

                    // Supprimer les photos
                    await tx.photo.deleteMany({
                        where: { commandeId: commande.id }
                    });
                }

                // 2. Maintenant supprimer les commandes
                await tx.commande.deleteMany({
                    where: { magasinId: id }
                });

                // 3. Supprimer les utilisateurs
                await tx.user.deleteMany({
                    where: { magasinId: id }
                });

                // 4. Supprimer factures et devis
                await tx.facture.deleteMany({
                    where: { magasinId: id }
                });

                await tx.devis.deleteMany({
                    where: { magasinId: id }
                });

                // 5. Supprimer les cessions
                await tx.cessionInterMagasin.deleteMany({
                    where: {
                        OR: [
                            { magasinOrigineId: id },
                            { magasinDestinationId: id }
                        ]
                    }
                });

                // 6. Enfin supprimer le magasin
                await tx.magasin.delete({
                    where: { id }
                });
            });

            this.logger.log(`✅ Magasin supprimé avec nettoyage: ${existingMagasin.nom}`);
            return {
                message: 'Magasin supprimé avec succès (avec nettoyage des dépendances)',
                cleaned: true
            };
        }

        await this.prisma.magasin.delete({
            where: { id },
        });

        this.logger.log(`✅ Magasin supprimé: ${existingMagasin.nom}`);
        return { message: 'Magasin supprimé avec succès' };
    }

    async getDependencies(id: string) {
        const magasin = await this.findOne(id);

        const [users, commandes, factures, devis, cessionsOrigine, cessionsDestination] = await Promise.all([
            // Utilisateurs liés au magasin
            this.prisma.user.findMany({
                where: { magasinId: id },
                select: {
                    id: true,
                    nom: true,
                    prenom: true,
                    email: true,
                    role: true,
                    status: true,
                    createdAt: true
                }
            }),

            // Commandes liées au magasin
            this.prisma.commande.findMany({
                where: { magasinId: id },
                select: {
                    id: true,
                    numeroCommande: true,
                    dateCommande: true,
                    statutCommande: true,
                    statutLivraison: true,
                    tarifHT: true,
                    client: {
                        select: {
                            nom: true,
                            prenom: true
                        }
                    }
                },
                take: 20, // Limiter pour éviter surcharge
                orderBy: { dateCommande: 'desc' }
            }),

            // Factures liées au magasin
            this.prisma.facture.findMany({
                where: { magasinId: id },
                select: {
                    id: true,
                    numeroFacture: true,
                    dateFacture: true,
                    statut: true,
                    commande: {
                        select: {
                            numeroCommande: true
                        }
                    }
                },
                take: 10,
                orderBy: { dateFacture: 'desc' }
            }),

            // Devis liés au magasin
            this.prisma.devis.findMany({
                where: { magasinId: id },
                select: {
                    id: true,
                    numeroDevis: true,
                    dateDevis: true,
                    statut: true,
                    commande: {
                        select: {
                            numeroCommande: true
                        }
                    }
                },
                take: 10,
                orderBy: { dateDevis: 'desc' }
            }),

            // Cessions origine
            this.prisma.cessionInterMagasin.findMany({
                where: { magasinOrigineId: id },
                select: {
                    id: true,
                    numeroCession: true,
                    dateCession: true,
                    statutCession: true,
                    magasinDestination: {
                        select: { nom: true }
                    }
                },
                take: 5,
                orderBy: { dateCession: 'desc' }
            }),

            // Cessions destination
            this.prisma.cessionInterMagasin.findMany({
                where: { magasinDestinationId: id },
                select: {
                    id: true,
                    numeroCession: true,
                    dateCession: true,
                    statutCession: true,
                    magasinOrigine: {
                        select: { nom: true }
                    }
                },
                take: 5,
                orderBy: { dateCession: 'desc' }
            })
        ]);

        const result = {
            magasin: {
                id: magasin.id,
                nom: magasin.nom
            },
            dependencies: {
                users: {
                    count: users.length,
                    items: users
                },
                commandes: {
                    count: commandes.length,
                    items: commandes,
                    totalInDb: await this.prisma.commande.count({ where: { magasinId: id } })
                },
                factures: {
                    count: factures.length,
                    items: factures,
                    totalInDb: await this.prisma.facture.count({ where: { magasinId: id } })
                },
                devis: {
                    count: devis.length,
                    items: devis,
                    totalInDb: await this.prisma.devis.count({ where: { magasinId: id } })
                },
                cessionsOrigine: {
                    count: cessionsOrigine.length,
                    items: cessionsOrigine
                },
                cessionsDestination: {
                    count: cessionsDestination.length,
                    items: cessionsDestination
                }
            },
            totaux: {
                users: users.length,
                commandes: await this.prisma.commande.count({ where: { magasinId: id } }),
                factures: await this.prisma.facture.count({ where: { magasinId: id } }),
                devis: await this.prisma.devis.count({ where: { magasinId: id } }),
                cessionsOrigine: cessionsOrigine.length,
                cessionsDestination: cessionsDestination.length,
                total: users.length +
                    await this.prisma.commande.count({ where: { magasinId: id } }) +
                    await this.prisma.facture.count({ where: { magasinId: id } }) +
                    await this.prisma.devis.count({ where: { magasinId: id } }) +
                    cessionsOrigine.length +
                    cessionsDestination.length
            }
        };

        this.logger.log(`✅ Dépendances calculées pour magasin ${magasin.nom}: ${result.totaux.total} éléments`);
        return result;
    }

    async getStats(id: string) {
        const magasin = await this.findOne(id);

        // Statistiques simplifiées (comme chauffeurs)
        const [commandesParStatut, livraisonsParStatut, chiffreAffaire] = await Promise.all([
            // Commandes par statut
            this.prisma.commande.groupBy({
                by: ['statutCommande'],
                where: { magasinId: id },
                _count: { statutCommande: true },
            }),

            // Livraisons par statut
            this.prisma.commande.groupBy({
                by: ['statutLivraison'],
                where: { magasinId: id },
                _count: { statutLivraison: true },
            }),

            // Chiffre d'affaire total
            this.prisma.commande.aggregate({
                where: { magasinId: id },
                _sum: { tarifHT: true },
            }),
        ]);

        return {
            magasin: {
                id: magasin.id,
                nom: magasin.nom,
            },
            totaux: magasin._count,
            commandes: {
                parStatut: commandesParStatut.map(stat => ({
                    statut: stat.statutCommande,
                    nombre: stat._count.statutCommande,
                })),
            },
            livraisons: {
                parStatut: livraisonsParStatut.map(stat => ({
                    statut: stat.statutLivraison,
                    nombre: stat._count.statutLivraison,
                })),
            },
            financier: {
                chiffreAffairesTotalHT: chiffreAffaire._sum.tarifHT || 0,
            },
        };
    }
}