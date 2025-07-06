import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCommandeDto, UpdateCommandeDto, CommandeFiltersDto } from './dto';
import { Prisma } from '@prisma/client';
import { TrackingService } from '../tracking/tracking.service';
import { TrackingEventType } from '@prisma/client';

@Injectable()
export class CommandesService {
    private readonly logger = new Logger(CommandesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly trackingService: TrackingService
    ) { }

    async findAll(filters: CommandeFiltersDto) {
        const {
            skip,
            take,
            statutCommande,
            statutLivraison,
            magasinId,
            chauffeurId,
            dateLivraisonDebut,
            dateLivraisonFin,
        } = filters;

        // Construction du filtre where
        const where: Prisma.CommandeWhereInput = {};

        if (statutCommande) where.statutCommande = statutCommande;
        if (statutLivraison) where.statutLivraison = statutLivraison;
        if (magasinId) where.magasinId = magasinId;

        if (chauffeurId) {
            where.chauffeurs = {
                some: {
                    chauffeurId: chauffeurId,
                },
            };
        }

        if (dateLivraisonDebut || dateLivraisonFin) {
            where.dateLivraison = {};
            if (dateLivraisonDebut) {
                where.dateLivraison.gte = new Date(dateLivraisonDebut);
            }
            if (dateLivraisonFin) {
                where.dateLivraison.lte = new Date(dateLivraisonFin);
            }
        }

        const [commandes, total] = await Promise.all([
            this.prisma.commande.findMany({
                where,
                skip: skip || 0,
                take: take || 50,
                orderBy: { dateCommande: 'desc' },
                include: {
                    client: {
                        select: {
                            id: true,
                            nom: true,
                            prenom: true,
                            telephone: true,
                            adresseLigne1: true,
                            ville: true,
                            typeAdresse: true,
                        },
                    },
                    magasin: {
                        select: {
                            id: true,
                            nom: true,
                            telephone: true,
                        },
                    },
                    chauffeurs: {
                        include: {
                            chauffeur: {
                                select: {
                                    id: true,
                                    nom: true,
                                    prenom: true,
                                    telephone: true,
                                    status: true,
                                },
                            },
                        },
                    },
                    articles: true,
                    _count: {
                        select: {
                            photos: true,
                            commentaires: true,
                            rapportsEnlevement: true,
                            rapportsLivraison: true,
                        },
                    },
                },
            }),
            this.prisma.commande.count({ where }),
        ]);

        return {
            data: commandes,
            meta: {
                total,
                skip: skip || 0,
                take: take || 50,
                hasMore: (skip || 0) + (take || 50) < total,
            },
        };
    }

    async findOne(id: string) {
        const commande = await this.prisma.commande.findUnique({
            where: { id },
            include: {
                client: true,
                magasin: {
                    select: {
                        id: true,
                        nom: true,
                        adresse: true,
                        telephone: true,
                        email: true,
                    },
                },
                chauffeurs: {
                    include: {
                        chauffeur: {
                            select: {
                                id: true,
                                nom: true,
                                prenom: true,
                                telephone: true,
                                email: true,
                                status: true,
                                notes: true,
                            },
                        },
                    },
                },
                articles: true,
                photos: {
                    orderBy: { createdAt: 'desc' },
                },
                commentaires: {
                    orderBy: { createdAt: 'desc' },
                },
                rapportsEnlevement: {
                    include: {
                        chauffeur: {
                            select: {
                                nom: true,
                                prenom: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                rapportsLivraison: {
                    include: {
                        chauffeur: {
                            select: {
                                nom: true,
                                prenom: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                factures: {
                    select: {
                        id: true,
                        numeroFacture: true,
                        dateFacture: true,
                        statut: true,
                    },
                },
                devis: {
                    select: {
                        id: true,
                        numeroDevis: true,
                        dateDevis: true,
                        statut: true,
                    },
                },
            },
        });

        if (!commande) {
            throw new NotFoundException(`Commande avec l'ID ${id} non trouvée`);
        }

        return commande;
    }

    async create(createCommandeDto: CreateCommandeDto) {
        const { client: clientData, articles: articlesData, chauffeurIds, ...commandeData } = createCommandeDto;

        this.logger.log(`🆕 Création d'une nouvelle commande pour ${clientData.nom} ${clientData.prenom}`);

        // Vérifier que le magasin existe
        const magasin = await this.prisma.magasin.findUnique({
            where: { id: createCommandeDto.magasinId },
        });

        if (!magasin) {
            throw new BadRequestException(`Magasin avec l'ID ${createCommandeDto.magasinId} non trouvé`);
        }

        // Vérifier les chauffeurs s'ils sont fournis
        if (chauffeurIds && chauffeurIds.length > 0) {
            const chauffeurs = await this.prisma.chauffeur.findMany({
                where: { id: { in: chauffeurIds } },
            });

            if (chauffeurs.length !== chauffeurIds.length) {
                throw new BadRequestException('Un ou plusieurs chauffeurs spécifiés n\'existent pas');
            }
        }

        return this.prisma.$transaction(async (tx) => {
            // 1. Rechercher ou créer le client
            const client = await this.findOrCreateClient(tx, clientData);

            // 2. Générer le numéro de commande
            const numeroCommande = await this.generateNumeroCommande(tx);

            // 3. Créer la commande avec toutes les relations en une seule fois
            const commande = await tx.commande.create({
                data: {
                    numeroCommande,
                    dateLivraison: new Date(createCommandeDto.dateLivraison),
                    creneauLivraison: createCommandeDto.creneauLivraison,
                    categorieVehicule: createCommandeDto.categorieVehicule,
                    optionEquipier: createCommandeDto.optionEquipier || 0,
                    tarifHT: createCommandeDto.tarifHT || 0,
                    reserveTransport: createCommandeDto.reserveTransport || false,
                    prenomVendeur: createCommandeDto.prenomVendeur,

                    // Relations
                    clientId: client.id,
                    magasinId: createCommandeDto.magasinId,
                },
                include: {
                    client: true,
                    magasin: {
                        select: {
                            id: true,
                            nom: true,
                            telephone: true,
                        },
                    },
                    chauffeurs: {
                        include: {
                            chauffeur: {
                                select: {
                                    id: true,
                                    nom: true,
                                    prenom: true,
                                    telephone: true,
                                    status: true,
                                },
                            },
                        },
                    },
                    articles: true,
                    _count: {
                        select: {
                            photos: true,
                            commentaires: true,
                            rapportsEnlevement: true,
                            rapportsLivraison: true,
                        },
                    },
                },
            });

            // 4. Créer les articles
            if (articlesData) {
                await tx.article.create({
                    data: {
                        nombre: articlesData.nombre,
                        details: articlesData.details,
                        categories: articlesData.categories || [],
                        commandeId: commande.id,
                    },
                });
            }

            // 5. Assigner les chauffeurs
            if (chauffeurIds && chauffeurIds.length > 0) {
                await Promise.all(
                    chauffeurIds.map(chauffeurId =>
                        tx.chauffeurSurCommande.create({
                            data: {
                                chauffeurId,
                                commandeId: commande.id,
                            },
                        })
                    )
                );
            }

            this.logger.log(`✅ Commande créée: ${numeroCommande} (${commande.id})`);

            // 6. Retourner directement la commande créée (elle contient déjà toutes les relations)
            return commande;
        });
    }

    async update(id: string, updateCommandeDto: UpdateCommandeDto) {
        if (!id) {
            throw new BadRequestException('ID de commande requis pour la mise à jour');
        }

        // Vérifier que la commande existe
        const existingCommande = await this.findOne(id);

        this.logger.log(`📝 Mise à jour de la commande ${existingCommande.numeroCommande}`);

        // Pour l'instant, ne mettre à jour que les champs simples de la commande
        const updateData: any = {};

        if (updateCommandeDto.dateLivraison) {
            updateData.dateLivraison = new Date(updateCommandeDto.dateLivraison);
        }
        if (updateCommandeDto.creneauLivraison !== undefined) {
            updateData.creneauLivraison = updateCommandeDto.creneauLivraison;
        }
        if (updateCommandeDto.categorieVehicule !== undefined) {
            updateData.categorieVehicule = updateCommandeDto.categorieVehicule;
        }
        if (updateCommandeDto.optionEquipier !== undefined) {
            updateData.optionEquipier = updateCommandeDto.optionEquipier;
        }
        if (updateCommandeDto.tarifHT !== undefined) {
            updateData.tarifHT = updateCommandeDto.tarifHT;
        }
        if (updateCommandeDto.reserveTransport !== undefined) {
            updateData.reserveTransport = updateCommandeDto.reserveTransport;
        }
        if (updateCommandeDto.statutCommande !== undefined) {
            updateData.statutCommande = updateCommandeDto.statutCommande;
        }
        if (updateCommandeDto.statutLivraison !== undefined) {
            updateData.statutLivraison = updateCommandeDto.statutLivraison;
        }
        if (updateCommandeDto.prenomVendeur !== undefined) {
            updateData.prenomVendeur = updateCommandeDto.prenomVendeur;
        }

        // Mettre à jour seulement si il y a des données à modifier
        if (Object.keys(updateData).length > 0) {
            await this.prisma.commande.update({
                where: { id },
                data: updateData,
            });
        }

        this.logger.log(`✅ Commande mise à jour: ${existingCommande.numeroCommande}`);

        // Retourner la commande mise à jour
        return this.findOne(id);
    }

    async updateStatutLivraison(
        commandeId: string,
        newStatus: string,
        userId: string,
        reason?: string
    ) {
        const existingCommande = await this.findOne(commandeId);

        // Mettre à jour via le tracking service pour l'historique
        const updatedCommande = await this.trackingService.updateCommandeStatus(
            commandeId,
            newStatus,
            userId,
            reason
        );

        // Créer l'événement de tracking approprié
        let eventType: TrackingEventType;
        switch (newStatus) {
            case 'EN COURS':
                eventType = TrackingEventType.PICKUP_STARTED;
                break;
            case 'EN ROUTE':
                eventType = TrackingEventType.IN_TRANSIT;
                break;
            case 'LIVREE':
                eventType = TrackingEventType.DELIVERY_COMPLETED;
                break;
            default:
                eventType = TrackingEventType.EXCEPTION;
        }

        await this.trackingService.createTrackingEvent({
            commandeId,
            eventType,
            metadata: { statusChange: { from: existingCommande.statutLivraison, to: newStatus } }
        });

        this.logger.log(`✅ Statut mis à jour: ${existingCommande.numeroCommande} -> ${newStatus}`);

        return this.findOne(commandeId);
    }

    async remove(id: string) {
        const existingCommande = await this.findOne(id);

        // Vérifier qu'on peut supprimer (pas de factures, etc.)
        const dependencies = await this.prisma.commande.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        factures: true,
                        devis: true,
                    },
                },
            },
        });

        if (dependencies._count.factures > 0 || dependencies._count.devis > 0) {
            throw new BadRequestException(
                'Impossible de supprimer une commande qui a des factures ou devis associés'
            );
        }

        await this.prisma.commande.delete({ where: { id } });

        this.logger.log(`🗑️ Commande supprimée: ${existingCommande.numeroCommande}`);
        return { message: 'Commande supprimée avec succès' };
    }

    async getStats(magasinId?: string) {
        const where: Prisma.CommandeWhereInput = magasinId ? { magasinId } : {};

        const [
            totalCommandes,
            commandesParStatut,
            livraisonsParStatut,
            commandesAujourdhui,
            chiffreAffaire,
        ] = await Promise.all([
            // Total des commandes
            this.prisma.commande.count({ where }),

            // Commandes par statut
            this.prisma.commande.groupBy({
                by: ['statutCommande'],
                where,
                _count: { statutCommande: true },
            }),

            // Livraisons par statut
            this.prisma.commande.groupBy({
                by: ['statutLivraison'],
                where,
                _count: { statutLivraison: true },
            }),

            // Commandes du jour
            this.prisma.commande.count({
                where: {
                    ...where,
                    dateCommande: {
                        gte: new Date(new Date().setHours(0, 0, 0, 0)),
                    },
                },
            }),

            // Chiffre d'affaire total
            this.prisma.commande.aggregate({
                where,
                _sum: { tarifHT: true },
            }),
        ]);

        return {
            totaux: {
                commandes: totalCommandes,
                commandesAujourdhui,
                chiffreAffaireHT: chiffreAffaire._sum.tarifHT || 0,
            },
            repartition: {
                parStatutCommande: commandesParStatut.map(stat => ({
                    statut: stat.statutCommande,
                    nombre: stat._count.statutCommande,
                })),
                parStatutLivraison: livraisonsParStatut.map(stat => ({
                    statut: stat.statutLivraison,
                    nombre: stat._count.statutLivraison,
                })),
            },
        };
    }

    // Méthodes utilitaires privées
    private async findOrCreateClient(tx: Prisma.TransactionClient, clientData: any) {
        // Rechercher un client existant par nom et téléphone
        let client = await tx.client.findFirst({
            where: {
                nom: clientData.nom,
                telephone: clientData.telephone,
            },
        });

        if (!client) {
            // Créer un nouveau client
            client = await tx.client.create({
                data: {
                    nom: clientData.nom,
                    prenom: clientData.prenom,
                    telephone: clientData.telephone,
                    telephoneSecondaire: clientData.telephoneSecondaire,
                    adresseLigne1: clientData.adresseLigne1,
                    codePostal: clientData.codePostal,
                    ville: clientData.ville,
                    batiment: clientData.batiment,
                    etage: clientData.etage,
                    interphone: clientData.interphone,
                    ascenseur: clientData.ascenseur || false,
                    typeAdresse: clientData.typeAdresse,
                },
            });
        } else {
            // Mettre à jour les informations du client existant
            client = await tx.client.update({
                where: { id: client.id },
                data: {
                    prenom: clientData.prenom || client.prenom,
                    telephoneSecondaire: clientData.telephoneSecondaire || client.telephoneSecondaire,
                    adresseLigne1: clientData.adresseLigne1,
                    codePostal: clientData.codePostal || client.codePostal,
                    ville: clientData.ville || client.ville,
                    batiment: clientData.batiment || client.batiment,
                    etage: clientData.etage || client.etage,
                    interphone: clientData.interphone || client.interphone,
                    ascenseur: clientData.ascenseur ?? client.ascenseur,
                    typeAdresse: clientData.typeAdresse || client.typeAdresse,
                },
            });
        }

        return client;
    }

    private async generateNumeroCommande(tx: Prisma.TransactionClient): Promise<string> {
        // Format: CMD + timestamp + nombre aléatoire
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `CMD${timestamp}${random}`;
    }
}