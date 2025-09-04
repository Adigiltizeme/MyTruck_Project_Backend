import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateChauffeurDto, UpdateChauffeurDto, ChauffeurFiltersDto, UpdateChauffeurPasswordDto, GeneratePasswordDto } from './dto';
import { Prisma } from '@prisma/client';
import { TrackingService } from '../tracking/tracking.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ChauffeursService {
    private readonly logger = new Logger(ChauffeursService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly trackingService: TrackingService
    ) { }

    async findAll(filters: ChauffeurFiltersDto) {
        const { skip, take, status, noteMinimum } = filters;

        // Construction du filtre where
        const where: Prisma.ChauffeurWhereInput = {};

        if (status) {
            where.status = status;
        }

        if (noteMinimum) {
            where.notes = {
                gte: noteMinimum,
            };
        }

        const [chauffeurs, total] = await Promise.all([
            this.prisma.chauffeur.findMany({
                where,
                skip: skip || 0,
                take: take || 50,
                orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
                select: {
                    // ✅ AJOUTER tous les champs nécessaires
                    id: true,
                    nom: true,
                    prenom: true,
                    telephone: true,
                    email: true,
                    status: true,
                    longitude: true,
                    latitude: true,
                    notes: true,
                    // ✅ CRUCIAL : Ajouter le champ role manquant
                    // Si le champ n'existe pas en base, ajouter une valeur par défaut
                    createdAt: true,
                    updatedAt: true,
                    airtableId: true,
                    lastSyncedAt: true,
                    _count: {
                        select: {
                            assignations: true,
                            rapportsEnlevement: true,
                            rapportsLivraison: true,
                        },
                    },
                },
            }),
            this.prisma.chauffeur.count({ where }),
        ]);

        const chauffeursWithRole = chauffeurs.map(chauffeur => ({
            ...chauffeur,
            role: 'Chauffeur' // ✅ Forcer le rôle puisque c'est l'endpoint chauffeurs
        }));


        return {
            data: chauffeursWithRole,
            meta: {
                total,
                skip: skip || 0,
                take: take || 50,
                hasMore: (skip || 0) + (take || 50) < total,
            },
        };
    }

    async findOne(id: string) {
        const chauffeur = await this.prisma.chauffeur.findUnique({
            where: { id },
            include: {
                assignations: {
                    include: {
                        commande: {
                            select: {
                                id: true,
                                numeroCommande: true,
                                dateCommande: true,
                                dateLivraison: true,
                                statutCommande: true,
                                statutLivraison: true,
                                client: {
                                    select: {
                                        nom: true,
                                        prenom: true,
                                    },
                                },
                                magasin: {
                                    select: {
                                        nom: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { assignedAt: 'desc' },
                    take: 10, // 10 dernières assignations
                },
                rapportsEnlevement: {
                    include: {
                        commande: {
                            select: {
                                numeroCommande: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                rapportsLivraison: {
                    include: {
                        commande: {
                            select: {
                                numeroCommande: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                _count: {
                    select: {
                        assignations: true,
                        rapportsEnlevement: true,
                        rapportsLivraison: true,
                    },
                },
            },
        });

        if (!chauffeur) {
            throw new NotFoundException(`Chauffeur avec l'ID ${id} non trouvé`);
        }

        return chauffeur;
    }

    async create(createChauffeurDto: CreateChauffeurDto) {
        const { password, ...chauffeurData } = createChauffeurDto;
        
        // Si pas d'email fourni, générer un email par défaut
        if (!chauffeurData.email) {
            chauffeurData.email = `${chauffeurData.prenom?.toLowerCase()}.${chauffeurData.nom?.toLowerCase()}@mytruck.com`;
        }
        
        // Générer un mot de passe par défaut si pas fourni
        const defaultPassword = password || this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);

        const chauffeur = await this.prisma.chauffeur.create({
            data: {
                ...chauffeurData,
                password: hashedPassword,
                hasAccount: true,
                accountStatus: 'active',
            },
            include: {
                _count: {
                    select: {
                        assignations: true,
                        rapportsEnlevement: true,
                        rapportsLivraison: true,
                    },
                },
            },
        });

        this.logger.log(`✅ Chauffeur et utilisateur créés: ${chauffeur.nom} ${chauffeur.prenom} (${chauffeur.id})`);
        if (!password) {
            this.logger.log(`🔑 Mot de passe généré: ${defaultPassword}`);
        }
        
        return {
            ...chauffeur,
            temporaryPassword: !password ? defaultPassword : undefined,
        };
    }

    private generateRandomPassword(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async update(id: string, updateChauffeurDto: UpdateChauffeurDto) {
        // Vérifier que le chauffeur existe
        await this.findOne(id);

        const chauffeur = await this.prisma.chauffeur.update({
            where: { id },
            data: updateChauffeurDto,
            include: {
                _count: {
                    select: {
                        assignations: true,
                        rapportsEnlevement: true,
                        rapportsLivraison: true,
                    },
                },
            },
        });

        this.logger.log(`✅ Chauffeur mis à jour: ${chauffeur.nom} ${chauffeur.prenom} (${chauffeur.id})`);
        return chauffeur;
    }

    async remove(id: string, forceDelete: boolean = false) {
        const existingChauffeur = await this.findOne(id);

        if (!forceDelete) {
            // Vérifier qu'il n'y a pas d'assignations actives (logique existante)
            const assignationsActives = await this.prisma.chauffeurSurCommande.count({
                where: {
                    chauffeurId: id,
                    commande: {
                        statutLivraison: {
                            notIn: ['LIVREE', 'ANNULEE'],
                        },
                    },
                },
            });

            if (assignationsActives > 0) {
                throw new BadRequestException(
                    `Impossible de supprimer le chauffeur car il a ${assignationsActives} assignation(s) active(s)`
                );
            }
        } else {
            // SUPPRESSION FORCÉE - Nettoyer les dépendances
            this.logger.warn(`🚨 SUPPRESSION FORCÉE du chauffeur: ${existingChauffeur.nom} ${existingChauffeur.prenom}`);

            await this.prisma.$transaction(async (tx) => {
                // 1. Supprimer toutes les assignations
                await tx.chauffeurSurCommande.deleteMany({
                    where: { chauffeurId: id }
                });

                // 2. Supprimer les rapports d'enlèvement
                await tx.rapportEnlevement.deleteMany({
                    where: { chauffeurId: id }
                });

                // 3. Supprimer les rapports de livraison
                await tx.rapportLivraison.deleteMany({
                    where: { chauffeurId: id }
                });

                // 4. Supprimer le chauffeur
                await tx.chauffeur.delete({
                    where: { id }
                });
            });

            this.logger.log(`✅ Chauffeur supprimé avec nettoyage: ${existingChauffeur.nom} ${existingChauffeur.prenom}`);
            return {
                message: 'Chauffeur supprimé avec succès (avec nettoyage des dépendances)',
                cleaned: true
            };
        }

        await this.prisma.chauffeur.delete({
            where: { id },
        });

        this.logger.log(`✅ Chauffeur supprimé: ${existingChauffeur.nom} ${existingChauffeur.prenom}`);
        return { message: 'Chauffeur supprimé avec succès' };
    }

    async findAvailableDrivers(dateLivraison: Date, excludeIds: string[] = []) {
        // Trouver les chauffeurs disponibles pour une date donnée
        // (qui n'ont pas d'assignation ce jour-là ou qui ont terminé leurs livraisons)

        const startOfDay = new Date(dateLivraison);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(dateLivraison);
        endOfDay.setHours(23, 59, 59, 999);

        return this.prisma.chauffeur.findMany({
            where: {
                status: 'Actif',
                id: {
                    notIn: excludeIds,
                },
                assignations: {
                    none: {
                        commande: {
                            dateLivraison: {
                                gte: startOfDay,
                                lte: endOfDay,
                            },
                            statutLivraison: {
                                notIn: ['LIVREE', 'ANNULEE'],
                            },
                        },
                    },
                },
            },
            include: {
                _count: {
                    select: {
                        assignations: true,
                    },
                },
            },
            orderBy: [
                { notes: 'desc' },
                { nom: 'asc' },
            ],
        });
    }

    async getChauffeurStats(id: string) {
        const chauffeur = await this.findOne(id);

        const [
            totalAssignations,
            assignationsParStatut,
            livraisonsTerminees,
            moyenneNotes,
            derniereAssignation,
        ] = await Promise.all([
            // Total des assignations
            this.prisma.chauffeurSurCommande.count({
                where: { chauffeurId: id },
            }),

            // Assignations par statut de livraison
            this.prisma.chauffeurSurCommande.groupBy({
                by: ['commandeId'],
                where: { chauffeurId: id },
                _count: { chauffeurId: true },
            }),

            // Livraisons terminées avec succès
            this.prisma.chauffeurSurCommande.count({
                where: {
                    chauffeurId: id,
                    commande: {
                        statutLivraison: 'LIVREE',
                    },
                },
            }),

            // Note moyenne (déjà dans le chauffeur)
            chauffeur.notes,

            // Dernière assignation
            this.prisma.chauffeurSurCommande.findFirst({
                where: { chauffeurId: id },
                include: {
                    commande: {
                        select: {
                            numeroCommande: true,
                            dateLivraison: true,
                            statutLivraison: true,
                            client: {
                                select: {
                                    nom: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { assignedAt: 'desc' },
            }),
        ]);

        const tauxReussite = totalAssignations > 0
            ? Math.round((livraisonsTerminees / totalAssignations) * 100)
            : 0;

        return {
            chauffeur: {
                id: chauffeur.id,
                nom: chauffeur.nom,
                prenom: chauffeur.prenom,
                notes: chauffeur.notes,
            },
            totaux: {
                assignations: totalAssignations,
                livraisonsTerminees,
                tauxReussite,
            },
            derniereAssignation,
            performance: {
                noteGlobale: moyenneNotes,
                tauxReussite,
            },
        };
    }

    async updatePosition(id: string, longitude: number, latitude: number) {
        await this.findOne(id); // Vérifier que le chauffeur existe

        const chauffeur = await this.trackingService.updateChauffeurPosition(
            id,
            latitude,
            longitude
        );

        this.logger.debug(`📍 Position mise à jour pour ${chauffeur.nom} ${chauffeur.prenom}: ${longitude}, ${latitude}`);

        return chauffeur;
    }

    async updateProfile(id: string, updateData: any) {
        await this.findOne(id); // Vérifier que le chauffeur existe

        return this.prisma.chauffeur.update({
            where: { id },
            data: {
                nom: updateData.nom,
                prenom: updateData.prenom,
                email: updateData.email,
                telephone: updateData.telephone,
            },
        });
    }

    async findByStatus(status: string) {
        return this.prisma.chauffeur.findMany({
            where: { status },
            include: {
                _count: {
                    select: {
                        assignations: true,
                    },
                },
            },
            orderBy: [
                { notes: 'desc' },
                { nom: 'asc' },
            ],
        });
    }

    async getDependencies(id: string) {
        const chauffeur = await this.findOne(id);

        const [assignations, rapportsEnlevement, rapportsLivraison] = await Promise.all([
            // Assignations du chauffeur (commandes)
            this.prisma.chauffeurSurCommande.findMany({
                where: { chauffeurId: id },
                include: {
                    commande: {
                        select: {
                            id: true,
                            numeroCommande: true,
                            dateCommande: true,
                            dateLivraison: true,
                            statutCommande: true,
                            statutLivraison: true,
                            tarifHT: true,
                            client: {
                                select: {
                                    nom: true,
                                    prenom: true
                                }
                            },
                            magasin: {
                                select: {
                                    nom: true
                                }
                            }
                        }
                    }
                },
                take: 20,
                orderBy: { assignedAt: 'desc' }
            }),

            // Rapports d'enlèvement
            this.prisma.rapportEnlevement.findMany({
                where: { chauffeurId: id },
                include: {
                    commande: {
                        select: {
                            numeroCommande: true,
                            client: {
                                select: {
                                    nom: true,
                                    prenom: true
                                }
                            }
                        }
                    }
                },
                take: 10,
                orderBy: { createdAt: 'desc' }
            }),

            // Rapports de livraison
            this.prisma.rapportLivraison.findMany({
                where: { chauffeurId: id },
                include: {
                    commande: {
                        select: {
                            numeroCommande: true,
                            client: {
                                select: {
                                    nom: true,
                                    prenom: true
                                }
                            }
                        }
                    }
                },
                take: 10,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        const result = {
            chauffeur: {
                id: chauffeur.id,
                nom: chauffeur.nom,
                prenom: chauffeur.prenom
            },
            dependencies: {
                assignations: {
                    count: assignations.length,
                    items: assignations.map(assign => ({
                        id: assign.id,
                        assignedAt: assign.assignedAt,
                        commande: assign.commande
                    })),
                    totalInDb: await this.prisma.chauffeurSurCommande.count({ where: { chauffeurId: id } })
                },
                rapportsEnlevement: {
                    count: rapportsEnlevement.length,
                    items: rapportsEnlevement.map(rapport => ({
                        id: rapport.id,
                        message: rapport.message,
                        createdAt: rapport.createdAt,
                        commande: rapport.commande
                    }))
                },
                rapportsLivraison: {
                    count: rapportsLivraison.length,
                    items: rapportsLivraison.map(rapport => ({
                        id: rapport.id,
                        message: rapport.message,
                        createdAt: rapport.createdAt,
                        commande: rapport.commande
                    }))
                }
            },
            totaux: {
                assignations: await this.prisma.chauffeurSurCommande.count({ where: { chauffeurId: id } }),
                rapportsEnlevement: rapportsEnlevement.length,
                rapportsLivraison: rapportsLivraison.length,
                total: await this.prisma.chauffeurSurCommande.count({ where: { chauffeurId: id } }) +
                    rapportsEnlevement.length +
                    rapportsLivraison.length
            }
        };

        this.logger.log(`✅ Dépendances calculées pour chauffeur ${chauffeur.nom} ${chauffeur.prenom}: ${result.totaux.total} éléments`);
        return result;
    }

    async updatePassword(id: string, updatePasswordDto: UpdateChauffeurPasswordDto) {
        const chauffeur = await this.findOne(id);
        const hashedPassword = await bcrypt.hash(updatePasswordDto.password, 10);

        await this.prisma.chauffeur.update({
            where: { id },
            data: { 
                password: hashedPassword,
                hasAccount: true,
                accountStatus: 'active'
            }
        });

        this.logger.log(`✅ Mot de passe mis à jour pour le chauffeur: ${chauffeur.nom} ${chauffeur.prenom}`);
        return { message: 'Mot de passe mis à jour avec succès' };
    }

    async generateNewPassword(id: string, options?: GeneratePasswordDto) {
        const chauffeur = await this.findOne(id);
        const newPassword = this.generateRandomPassword();
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await this.prisma.chauffeur.update({
            where: { id },
            data: { 
                password: hashedPassword,
                hasAccount: true,
                accountStatus: 'active'
            }
        });

        this.logger.log(`✅ Nouveau mot de passe généré pour: ${chauffeur.nom} ${chauffeur.prenom}`);
        return {
            message: 'Nouveau mot de passe généré avec succès',
            temporaryPassword: newPassword
        };
    }

    async syncUserProfile(id: string) {
        const chauffeur = await this.findOne(id);
        
        // Les données du chauffeur sont déjà dans le bon modèle, pas besoin de synchronisation séparée
        this.logger.log(`✅ Profil chauffeur déjà synchronisé: ${chauffeur.nom} ${chauffeur.prenom}`);
        return { message: 'Profil chauffeur déjà synchronisé' };
    }
}