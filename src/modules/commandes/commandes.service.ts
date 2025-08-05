import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCommandeDto, UpdateCommandeDto, CommandeFiltersDto } from './dto';
import { UpdateStatutsDto, StatutCommande, StatutLivraison } from './dto/statuts.dto';
import { Prisma } from '@prisma/client';
// import { TrackingService } from '../tracking/tracking.service';
// import { TrackingEventType } from '@prisma/client';

@Injectable()
export class CommandesService {
    private readonly logger = new Logger(CommandesService.name);

    constructor(
        private readonly prisma: PrismaService,
        // private readonly trackingService: TrackingService
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
                    photos: true,
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
                photos: {                    // ✅ AJOUTER : Include photos
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

        // ✅ AJOUTER : Log pour confirmer les photos
        console.log(`📸 findOne - Photos trouvées: ${commande.photos?.length || 0}`);
        if (commande.photos?.length > 0) {
            console.log(`📸 Première photo: ${commande.photos[0].url}`);
        }

        console.log(`📊 findOne - Chauffeurs trouvés: ${commande.chauffeurs?.length || 0}`);
        if (commande.chauffeurs?.length > 0) {
            console.log(`📊 Premier chauffeur:`, commande.chauffeurs[0]);
        }

        return commande;
    }

    async create(createCommandeDto: CreateCommandeDto) {
        // ✅ CORRECTION : Adapter pour les champs plats
        console.log('🔍 CreateCommandeDto reçu:', JSON.stringify(createCommandeDto, null, 2));

        // ✅ CONSTRUCTION de l'objet client à partir de l'objet imbriqué
        const clientData = {
            nom: createCommandeDto.client?.nom,
            prenom: createCommandeDto.client?.prenom,
            telephone: createCommandeDto.client?.telephone,
            telephoneSecondaire: createCommandeDto.client?.telephoneSecondaire,
            adresseLigne1: createCommandeDto.client?.adresseLigne1,
            batiment: createCommandeDto.client?.batiment,
            etage: createCommandeDto.client?.etage,
            interphone: createCommandeDto.client?.interphone,
            ascenseur: createCommandeDto.client?.ascenseur || false,
            typeAdresse: createCommandeDto.client?.typeAdresse || 'Domicile'
        };

        console.log('🔍 ClientData construit:', clientData);


        // ✅ CONSTRUCTION de l'objet articles à partir de l'objet imbriqué
        const articlesData = {
            nombre: createCommandeDto.articles?.nombre || 1,
            details: createCommandeDto.articles?.details || '',
            categories: createCommandeDto.articles?.categories || [],
            dimensions: createCommandeDto.articles?.dimensions || [],
            canBeTilted: createCommandeDto.articles?.canBeTilted || false
        };

        const allPhotos = [
            ...(createCommandeDto.articles?.photos || []),
            ...(createCommandeDto.articles?.newPhotos || [])
        ].filter(photo => photo.url);

        console.log('🔍 ClientData construit:', clientData);
        console.log('🔍 ArticlesData construit:', articlesData);
        console.log('🔍 Dimensions:', articlesData.dimensions.length);
        console.log('🔍 Photos totales à traiter:', allPhotos.length);

        if (!clientData.nom || !clientData.prenom) {
            console.error('❌ Données client manquantes:', clientData);
            throw new BadRequestException('Nom et prénom client requis');
        }

        // ✅ Extraire les autres champs
        const { client, articles, ...commandeData } = createCommandeDto;

        this.logger.log(`🆕 Création d'une nouvelle commande pour ${clientData.nom} ${clientData.prenom}`);

        // Vérifier que le magasin existe
        const magasin = await this.prisma.magasin.findUnique({
            where: { id: createCommandeDto.magasinId },
            select: {
                id: true,
                nom: true,
                telephone: true,
                adresse: true,
                email: true,
            },
        });

        if (!magasin) {
            throw new BadRequestException(`Magasin avec l'ID ${createCommandeDto.magasinId} non trouvé`);
        }

        this.logger.log(`🆕 Création commande pour ${clientData.nom} ${clientData.prenom} - ${articlesData.nombre} articles, ${articlesData.dimensions.length} dimensions, ${allPhotos.length} photos`);

        // ✅ Continuer avec la logique existante
        const commandeId = await this.prisma.$transaction(async (tx) => {
            // 1. Client
            const client = await this.findOrCreateClient(tx, clientData);

            // 2. Numéro commande
            const numeroCommande = await this.generateNumeroCommande(tx);

            // 3. Créer la commande
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
                    clientId: client.id,
                    magasinId: createCommandeDto.magasinId,
                }
            });

            // 4. Créer l'article avec dimensions
            if (articlesData) {
                await tx.article.create({
                    data: {
                        nombre: articlesData.nombre,
                        details: articlesData.details,
                        categories: articlesData.categories,
                        dimensions: JSON.stringify(articlesData.dimensions), // JSON
                        canBeTilted: articlesData.canBeTilted,
                        commandeId: commande.id,
                    },
                });
            }

            // 5. Créer les photos
            if (allPhotos.length > 0) {
                await tx.photo.createMany({
                    data: allPhotos.map(photo => ({
                        url: photo.url,
                        commandeId: commande.id,
                        type: 'ARTICLE',
                        filename: photo.url.split('/').pop() || 'image'
                    }))
                });
            }

            this.logger.log(`✅ Commande créée: ${commande.numeroCommande} avec ${articlesData.nombre} articles, ${articlesData.dimensions.length} dimensions, ${allPhotos.length} photos`);

            // ✅ RETOURNER L'ID pour utilisation hors transaction
            return commande.id;
        });

        // ✅ CORRECTION : findOne() HORS de la transaction avec l'ID correct
        return this.findOne(commandeId);
    }

    async update(id: string, updateCommandeDto: UpdateCommandeDto) {
        console.log('📝 ===== SERVICE UPDATE APPELÉ =====');
        console.log('📝 ID:', id);
        console.log('📝 DTO reçu:', updateCommandeDto);

        if (!id) {
            throw new BadRequestException('ID de commande requis pour la mise à jour');
        }

        // Vérifier que la commande existe
        const existingCommande = await this.findOne(id);

        this.logger.log(`📝 Mise à jour de la commande ${existingCommande.numeroCommande}`);

        if (updateCommandeDto.chauffeurIds && Array.isArray(updateCommandeDto.chauffeurIds)) {
            console.log('🚛 → Redirection vers assignChauffeurs');
            console.log('🚛 → IDs chauffeurs:', updateCommandeDto.chauffeurIds);

            return this.assignChauffeurs(id, updateCommandeDto.chauffeurIds, {
                statutCommande: updateCommandeDto.statutCommande,
                statutLivraison: updateCommandeDto.statutLivraison
            });
        }

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
            console.log('📊 Statut commande:', updateCommandeDto.statutCommande);
        }
        if (updateCommandeDto.statutLivraison !== undefined) {
            updateData.statutLivraison = updateCommandeDto.statutLivraison;
            console.log('📊 Mise à jour statut livraison:', updateCommandeDto.statutLivraison);

            // ✅ RÈGLE MÉTIER : Auto-confirmation commande si livraison confirmée
            if (updateCommandeDto.statutLivraison === 'CONFIRMEE' && existingCommande.statutCommande !== 'Confirmée') {
                updateData.statutCommande = 'Confirmée';
                console.log('📊 Auto-confirmation commande déclenchée');
            }
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
        } else {
            console.log('📝 Aucune donnée à mettre à jour pour cette commande');
            this.logger.log(`📝 Aucune donnée à mettre à jour pour cette commande: ${existingCommande.numeroCommande}`);
        }

        this.logger.log(`✅ Commande mise à jour: ${existingCommande.numeroCommande}`);

        // Retourner la commande mise à jour
        return this.findOne(id);
    }

    async updatePhotos(commandeId: string, photos: Array<{ url: string; filename?: string }>) {
        const existingCommande = await this.findOne(commandeId);

        this.logger.log(`📸 Mise à jour photos pour commande ${existingCommande.numeroCommande}: ${photos.length} photos`);

        const result = await this.prisma.$transaction(async (tx) => {
            // Supprimer toutes les anciennes photos
            await tx.photo.deleteMany({
                where: { commandeId }
            });

            // Ajouter les nouvelles photos
            if (photos.length > 0) {
                await tx.photo.createMany({
                    data: photos.map(photo => ({
                        url: photo.url,
                        commandeId,
                        type: 'ARTICLE',
                        filename: photo.filename || photo.url.split('/').pop() || 'image'
                    }))
                });
            }

            this.logger.log(`✅ Photos mises à jour: ${photos.length} photos sauvées`);

            // ✅ IMPORTANT : Retourner la commande COMPLÈTE
            return this.findOne(commandeId);
        });

        // ✅ AJOUTER log pour vérifier la structure de retour
        console.log('📸 Backend updatePhotos - Structure retour:', {
            id: result.id,
            numeroCommande: result.numeroCommande,
            clientNom: result.client?.nom,
            photosCount: result.photos?.length || 0,
            articlesCount: result.articles?.length || 0
        });

        return result;
    }

    async updateStatutLivraison(
        commandeId: string,
        newStatus: string,
        userId: string,
        reason?: string
    ) {
        const existingCommande = await this.findOne(commandeId);

        // Mettre à jour via le tracking service pour l'historique
        // const updatedCommande = await this.trackingService.updateCommandeStatus(
        //     commandeId,
        //     newStatus,
        //     userId,
        //     reason
        // );

        // Créer l'événement de tracking approprié
        // let eventType: TrackingEventType;
        // switch (newStatus) {
        //     case 'EN COURS':
        //         eventType = TrackingEventType.PICKUP_STARTED;
        //         break;
        //     case 'EN ROUTE':
        //         eventType = TrackingEventType.IN_TRANSIT;
        //         break;
        //     case 'LIVREE':
        //         eventType = TrackingEventType.DELIVERY_COMPLETED;
        //         break;
        //     default:
        //         eventType = TrackingEventType.EXCEPTION;
        // }

        // await this.trackingService.createTrackingEvent({
        //     commandeId,
        //     eventType,
        //     metadata: { statusChange: { from: existingCommande.statutLivraison, to: newStatus } }
        // });

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

    async assignChauffeurs(
        commandeId: string,
        chauffeurIds: string[],
        additionalUpdates?: { replaceAll?: boolean; statutCommande?: string; statutLivraison?: string }
    ) {
        console.log(`🚛 ===== ASSIGNATION CHAUFFEURS =====`);
        console.log(`🚛 Commande: ${commandeId}`);
        console.log(`🚛 Chauffeurs: ${chauffeurIds.join(', ')}`);
        console.log(`🚛 Mises à jour additionnelles:`, additionalUpdates);

        const existingCommande = await this.findOne(commandeId);

        return this.prisma.$transaction(async (tx) => {
            if (additionalUpdates?.replaceAll) {
                // ✅ MODE REMPLACEMENT : Supprimer tous et recréer
                console.log('🔄 Mode remplacement complet');

                // 1. Supprimer les anciennes assignations
                await tx.chauffeurSurCommande.deleteMany({
                    where: { commandeId }
                });

                // 2. Créer les nouvelles assignations
                if (chauffeurIds.length > 0) {
                    await tx.chauffeurSurCommande.createMany({
                        data: chauffeurIds.map(chauffeurId => ({
                            chauffeurId,
                            commandeId,
                            assignedAt: new Date()
                        }))
                    });
                }

                console.log(`✅ Remplacement: ${chauffeurIds.length} chauffeurs assignés`);
            } else {
                // ✅ MODE AJOUT : Logique existante
                const existingAssignments = await tx.chauffeurSurCommande.findMany({
                    where: { commandeId },
                    select: { chauffeurId: true }
                });

                // 3. Mettre à jour les statuts si fournis
                const updateData: any = {};
                if (additionalUpdates?.statutCommande) {
                    updateData.statutCommande = additionalUpdates.statutCommande;
                }
                if (additionalUpdates?.statutLivraison) {
                    updateData.statutLivraison = additionalUpdates.statutLivraison;
                }

                if (Object.keys(updateData).length > 0) {
                    await tx.commande.update({
                        where: { id: commandeId },
                        data: updateData
                    });
                }

                this.logger.log(`✅ ${chauffeurIds.length} chauffeurs assignés avec succès`);
            }

            // 4. Retourner la commande complète mise à jour
            return this.findOne(commandeId);
        });
    }

    // ✅ MÉTHODE 3 : Pour l'endpoint dédié
    async assignChauffeursWithStatus(
        commandeId: string,
        chauffeurIds: string[],
        options?: {
            statutCommande?: string;
            statutLivraison?: string;
            replaceAll?: boolean;
        }
    ) {
        console.log('🚛 Assignation via endpoint dédié');
        console.log('🚛 Options:', options);

        return this.assignChauffeurs(commandeId, chauffeurIds, options);
    }

    /**
 * Mise à jour intelligente des statuts avec règles métier
 */
    async updateStatutsWithBusinessRules(
        commandeId: string,
        updateData: UpdateStatutsDto,
        userId?: string
    ): Promise<any> {
        console.log(`📊 ===== MISE À JOUR STATUTS INTELLIGENTE =====`);
        console.log(`📊 Commande: ${commandeId}`);
        console.log(`📊 Données reçues:`, updateData);
        console.log(`📊 Utilisateur: ${userId}`);

        const existingCommande = await this.findOne(commandeId);

        return this.prisma.$transaction(async (tx) => {
            const finalUpdateData: any = {};
            let notifications: string[] = [];
            let autoActions: string[] = [];

            // ✅ RÈGLE 1 : Validation des transitions
            if (updateData.statutLivraison) {
                const isValidTransition = this.validateLivraisonTransition(
                    existingCommande.statutLivraison,
                    updateData.statutLivraison,
                    updateData.forceUpdate
                );

                if (!isValidTransition) {
                    throw new BadRequestException(
                        `Transition invalide: ${existingCommande.statutLivraison} → ${updateData.statutLivraison}`
                    );
                }

                finalUpdateData.statutLivraison = updateData.statutLivraison;

                // ✅ RÈGLE 2 : Auto-confirmation commande si livraison confirmée
                if (updateData.statutLivraison === StatutLivraison.CONFIRMEE &&
                    existingCommande.statutCommande !== StatutCommande.CONFIRMEE) {
                    finalUpdateData.statutCommande = StatutCommande.CONFIRMEE;
                    autoActions.push('Auto-confirmation commande déclenchée');
                }

                // ✅ RÈGLE 3 : Notifications selon statut
                switch (updateData.statutLivraison) {
                    case StatutLivraison.CONFIRMEE:
                        notifications.push('Livraison confirmée par My Truck');
                        break;
                    case StatutLivraison.ENLEVEE:
                        notifications.push('Articles enlevés du magasin');
                        break;
                    case StatutLivraison.EN_COURS:
                        notifications.push('Livraison en cours');
                        break;
                    case StatutLivraison.LIVREE:
                        notifications.push('Livraison terminée avec succès');
                        break;
                    case StatutLivraison.ECHEC:
                        notifications.push('Échec de livraison signalé');
                        break;
                }
            }

            // ✅ RÈGLE 4 : Validation statut commande
            if (updateData.statutCommande) {
                const isValidCommandeTransition = this.validateCommandeTransition(
                    existingCommande.statutCommande,
                    updateData.statutCommande,
                    existingCommande.statutLivraison,
                    updateData.forceUpdate
                );

                if (!isValidCommandeTransition) {
                    throw new BadRequestException(
                        `Transition commande invalide: ${existingCommande.statutCommande} → ${updateData.statutCommande}`
                    );
                }

                finalUpdateData.statutCommande = updateData.statutCommande;
            }

            // ✅ MISE À JOUR EN BASE
            const updatedCommande = await tx.commande.update({
                where: { id: commandeId },
                data: {
                    ...finalUpdateData,
                    updatedAt: new Date()
                }
            });

            // ✅ RÈGLE 5 : Audit trail
            if (updateData.reason || autoActions.length > 0) {
                await this.createAuditLog(tx, {
                    commandeId,
                    userId,
                    action: 'STATUS_UPDATE',
                    details: {
                        from: {
                            commande: existingCommande.statutCommande,
                            livraison: existingCommande.statutLivraison
                        },
                        to: {
                            commande: finalUpdateData.statutCommande || existingCommande.statutCommande,
                            livraison: finalUpdateData.statutLivraison || existingCommande.statutLivraison
                        },
                        reason: updateData.reason,
                        autoActions,
                        notifications
                    }
                });
            }

            console.log(`✅ Statuts mis à jour avec succès`);
            console.log(`📊 Actions automatiques: ${autoActions.join(', ')}`);
            console.log(`📧 Notifications: ${notifications.join(', ')}`);

            // ✅ Retourner commande complète mise à jour
            return this.findOne(commandeId);
        });
    }

    /**
     * Validation des transitions de statut livraison
     */
    private validateLivraisonTransition(
        current: string,
        target: string,
        force: boolean = false
    ): boolean {
        if (force) return true;

        const validTransitions: Record<string, string[]> = {
            'EN ATTENTE': ['CONFIRMEE', 'ANNULEE'],
            'CONFIRMEE': ['ENLEVEE', 'ANNULEE'],
            'ENLEVEE': ['EN COURS DE LIVRAISON', 'ECHEC'],
            'EN COURS DE LIVRAISON': ['LIVREE', 'ECHEC'],
            'LIVREE': [], // État final
            'ANNULEE': ['EN ATTENTE'], // Réactivation possible
            'ECHEC': ['EN ATTENTE', 'CONFIRMEE'] // Nouvelle tentative
        };

        return validTransitions[current]?.includes(target) || false;
    }

    /**
     * Validation des transitions de statut commande
     */
    private validateCommandeTransition(
        currentCommande: string,
        targetCommande: string,
        currentLivraison: string,
        force: boolean = false
    ): boolean {
        if (force) return true;

        // ✅ RÈGLE MÉTIER : Magasin ne peut pas modifier si livraison confirmée
        if (currentLivraison === 'CONFIRMEE' &&
            ['Annulée', 'Modifiée'].includes(targetCommande)) {
            return false;
        }

        const validTransitions: Record<string, string[]> = {
            'En attente': ['Confirmée', 'Annulée'],
            'Confirmée': ['Transmise', 'Modifiée', 'Annulée'],
            'Transmise': ['Confirmée', 'Modifiée', 'Annulée'],
            'Modifiée': ['Confirmée', 'Transmise', 'Annulée'],
            'Annulée': ['En attente'] // Réactivation possible
        };

        const isValid = validTransitions[currentCommande]?.includes(targetCommande) || false;

        console.log(`🔍 Validation transition: ${currentCommande} → ${targetCommande} = ${isValid}`);

        return isValid;
    }

    /**
     * Création d'audit trail
     */
    private async createAuditLog(tx: any, logData: {
        commandeId: string;
        userId?: string;
        action: string;
        details: any;
    }) {
        // ✅ Table d'audit (optionnel - créer si nécessaire)
        // await tx.auditLog.create({
        //     data: {
        //         commandeId: logData.commandeId,
        //         userId: logData.userId,
        //         action: logData.action,
        //         details: JSON.stringify(logData.details),
        //         timestamp: new Date()
        //     }
        // });

        // ✅ Pour l'instant, juste log console
        console.log('📋 AUDIT LOG:', logData);
    }
}