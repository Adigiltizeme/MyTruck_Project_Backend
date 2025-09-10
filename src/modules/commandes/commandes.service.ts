import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCommandeDto, UpdateCommandeDto, CommandeFiltersDto } from './dto';
import { UpdateStatutsDto, StatutCommande, StatutLivraison } from './dto/statuts.dto';
import { Prisma } from '@prisma/client';
import { CreateRapportDto, TypeRapport, UpdateRapportDto } from './dto/rapport.dto';
import { SlotsService } from '../slots/slots.service';
// import { TrackingService } from '../tracking/tracking.service';
// import { TrackingEventType } from '@prisma/client';

@Injectable()
export class CommandesService {
    private readonly logger = new Logger(CommandesService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly slotsService: SlotsService,
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
                            telephoneSecondaire: true,
                            adresseLigne1: true,
                            typeAdresse: true,
                            batiment: true,
                            etage: true,
                            interphone: true,
                            ascenseur: true,
                        },
                    },
                    magasin: {
                        select: {
                            id: true,
                            nom: true,
                            telephone: true,
                            email: true,
                            adresse: true,
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
                    articles: {
                        select: {
                            id: true,
                            nombre: true,
                            details: true,
                            categories: true,
                            dimensions: true,
                            canBeTilted: true,
                        },
                    },
                    photos: true,
                    _count: {
                        select: {
                            photos: true,
                            commentaires: true,
                            rapportsEnlevement: true,
                            rapportsLivraison: true,
                        },
                    },
                    documents: true,
                    timeSlot: {
                        select: {
                            id: true,
                            startTime: true,
                            endTime: true,
                            isActive: true,
                            maxCapacity: true,
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
                client: {
                    select: {
                        id: true,
                        nom: true,
                        prenom: true,
                        telephone: true,
                        telephoneSecondaire: true,
                        adresseLigne1: true,
                        typeAdresse: true,
                        batiment: true,
                        etage: true,
                        interphone: true,
                        ascenseur: true,
                    }
                },
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
                articles: {
                    select: {
                        id: true,
                        nombre: true,
                        details: true,
                        categories: true,
                        dimensions: true,
                        canBeTilted: true,
                    },
                },
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
                documents: true,
                // documents: {
                //     select: {
                //         id: true,
                //         type: true,
                //         url: true,
                //         createdAt: true,
                //     },
                // },
                timeSlot: {
                    select: {
                        id: true,
                        startTime: true,
                        endTime: true,
                        isActive: true,
                        maxCapacity: true,
                    },
                },
                statusHistory: {
                    orderBy: { changedAt: 'asc' },
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

    async create(createCommandeDto: any) {
        console.log('🔥 ===== SERVICE CREATE APPELÉ =====');
        console.log('🔥 DTO reçu type:', typeof createCommandeDto);
        console.log('🔥 DTO keys:', Object.keys(createCommandeDto));
        console.log('🔥 clientNom:', createCommandeDto.clientNom);
        console.log('🔥 nombreArticles:', createCommandeDto.nombreArticles);
        console.log('🔥 dimensionsArticles:', createCommandeDto.dimensionsArticles);
        // ✅ CORRECTION : Adapter pour les champs plats
        console.log('🔍 CreateCommandeDto reçu:', JSON.stringify(createCommandeDto, null, 2));

        try {
            // ✅ CLIENTS (structure flat qui fonctionne)
            const clientData = {
                nom: createCommandeDto.clientNom,
                prenom: createCommandeDto.clientPrenom || '',
                telephone: createCommandeDto.clientTelephone,
                telephoneSecondaire: createCommandeDto.clientTelephoneSecondaire || '',
                typeAdresse: createCommandeDto.clientTypeAdresse || 'Domicile',
                adresseLigne1: createCommandeDto.clientAdresseLigne1,
                batiment: createCommandeDto.clientBatiment || '',
                etage: createCommandeDto.clientEtage || '',
                interphone: createCommandeDto.clientInterphone || '',
                ascenseur: createCommandeDto.clientAscenseur || false,
            };

            console.log('🔍 ClientData construit:', clientData);

            // ✅ ARTICLES (structure flat)
            const articlesData = {
                nombre: createCommandeDto.nombreArticles || 1,
                details: createCommandeDto.detailsArticles || '',
                categories: createCommandeDto.categoriesArticles || [],
                dimensions: createCommandeDto.dimensionsArticles || [],
                canBeTilted: createCommandeDto.canBeTilted || false
            };

            const allPhotos = [
                ...(createCommandeDto.photosArticles || []),
                ...(createCommandeDto.newPhotosArticles || [])
            ].filter(photo => photo && photo.url);

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

            // 🆕 GÉRER LE CRÉNEAU LORS DE LA CRÉATION
            let timeSlotId: string | null = null;

            if (createCommandeDto.creneauLivraison) {
                // Trouver le créneau correspondant au displayName
                const timeSlot = await this.prisma.timeSlot.findFirst({
                    where: {
                        displayName: createCommandeDto.creneauLivraison,
                        isActive: true
                    }
                });

                if (timeSlot) {
                    // Vérifier la disponibilité
                    const date = new Date(createCommandeDto.dateLivraison).toISOString().split('T')[0];
                    const availability = await this.slotsService.getAvailabilityForDate(date);
                    const slotAvailability = availability.find(a => a.slot.id === timeSlot.id);

                    if (!slotAvailability?.isAvailable) {
                        throw new BadRequestException('Créneau non disponible pour cette date');
                    }

                    timeSlotId = timeSlot.id;
                }
            }

            this.logger.log(`🆕 Création commande pour ${clientData.nom} ${clientData.prenom} - ${articlesData.nombre} articles, ${articlesData.dimensions.length} dimensions, ${allPhotos.length} photos`);

            const deliveryConditions = {
                rueInaccessible: createCommandeDto.rueInaccessible || false,
                paletteComplete: createCommandeDto.paletteComplete || false,
                parkingDistance: createCommandeDto.parkingDistance || 0,
                hasStairs: createCommandeDto.hasStairs || false,
                stairCount: createCommandeDto.stairCount || 0,
                needsAssembly: createCommandeDto.needsAssembly || false,
                isDuplex: createCommandeDto.isDuplex || false,
                deliveryToUpperFloor: createCommandeDto.deliveryToUpperFloor || false
            };

            const articlesEquipiers = createCommandeDto.dimensionsArticles || [];
            const validation = this.calculateDeliveryValidation(articlesEquipiers, deliveryConditions, createCommandeDto);

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
                        remarques: createCommandeDto.remarques || '',
                        clientId: client.id,
                        magasinId: createCommandeDto.magasinId,
                        timeSlotId,
                        ...deliveryConditions,
                        requiredCrewSize: createCommandeDto.requiredCrewSize,
                        heaviestArticleWeight: createCommandeDto.heaviestArticleWeight,
                        needsQuote: createCommandeDto.needsQuote,
                        validationDetails: JSON.stringify(validation.details),
                        lastValidationAt: new Date(),
                    },
                });

                console.log('✅ Commande créée avec conditions de livraison:', {
                    id: commande.id,
                    conditions: deliveryConditions,
                    requiredCrew: validation.requiredCrewSize
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
                    console.log('📸 Création de', allPhotos.length, 'photos');

                    const photosToCreate = allPhotos.map(photo => ({
                        url: photo.url,
                        commandeId: commande.id,
                        type: 'ARTICLE' as any, // Fix: use enum if imported, otherwise cast
                        filename: photo.url.split('/').pop() || 'image'
                    }));

                    console.log('📸 Données photos à créer:', photosToCreate);

                    await tx.photo.createMany({
                        data: photosToCreate
                    });

                    console.log('✅ Photos créées avec succès');
                } else {
                    console.log('⚠️ PROBLÈME: Aucune photo à créer - vérifier extraction');
                }

                this.logger.log(`✅ Commande créée: ${commande.numeroCommande} avec ${articlesData.nombre} articles, ${articlesData.dimensions.length} dimensions, ${allPhotos.length} photos`);

                // ✅ RETOURNER L'ID pour utilisation hors transaction
                return commande.id;
            });

            // ✅ CORRECTION : findOne() HORS de la transaction avec l'ID correct
            return this.findOne(commandeId);

        } catch (error) {
            console.error('❌ ERREUR SERVICE CREATE:', error);
            console.error('❌ Error message:', error.message);
            console.error('❌ Error stack:', error.stack);
            throw error;
        }
    }

    async update(id: string, updateCommandeDto: UpdateCommandeDto) {
        console.log('📝 ===== SERVICE UPDATE APPELÉ =====');
        console.log('📝 ID:', id);
        console.log('📝 DTO reçu:', updateCommandeDto);
        console.log('🚚 Conditions livraison reçues:', updateCommandeDto.deliveryConditions);

        if (!id) {
            throw new BadRequestException('ID de commande requis pour la mise à jour');
        }

        // Vérifier que la commande existe
        const existingCommande = await this.findOne(id);

        // ✅ DÉTECTION AUTOMATIQUE du format
        const isNestedFormat = !!(updateCommandeDto.client || updateCommandeDto.articles);
        const isFlatFormat = !!(updateCommandeDto.clientNom || updateCommandeDto.nombreArticles);

        console.log('📝 Format détecté:', { isNestedFormat, isFlatFormat });

        // ✅ GESTION CLIENT selon le format
        if (isNestedFormat && updateCommandeDto.client) {
            console.log('📝 Mise à jour client NESTED');
            await this.prisma.client.update({
                where: { id: existingCommande.clientId },
                data: {
                    nom: updateCommandeDto.client.nom,
                    prenom: updateCommandeDto.client.prenom,
                    telephone: updateCommandeDto.client.telephone,
                    telephoneSecondaire: updateCommandeDto.client.telephoneSecondaire,
                    adresseLigne1: updateCommandeDto.client.adresseLigne1,
                    batiment: updateCommandeDto.client.batiment,
                    etage: updateCommandeDto.client.etage,
                    interphone: updateCommandeDto.client.interphone,
                    ascenseur: updateCommandeDto.client.ascenseur,
                    typeAdresse: updateCommandeDto.client.typeAdresse
                }
            });
        } else if (isFlatFormat && updateCommandeDto.clientNom) {
            console.log('📝 Mise à jour client FLAT');
            await this.prisma.client.update({
                where: { id: existingCommande.clientId },
                data: {
                    nom: updateCommandeDto.clientNom,
                    prenom: updateCommandeDto.clientPrenom,
                    telephone: updateCommandeDto.clientTelephone,
                    telephoneSecondaire: updateCommandeDto.clientTelephoneSecondaire,
                    adresseLigne1: updateCommandeDto.clientAdresseLigne1,
                    batiment: updateCommandeDto.clientBatiment,
                    etage: updateCommandeDto.clientEtage,
                    interphone: updateCommandeDto.clientInterphone,
                    ascenseur: updateCommandeDto.clientAscenseur,
                    typeAdresse: updateCommandeDto.clientTypeAdresse
                }
            });
        }
        // ✅ GESTION ARTICLES selon le format détecté
        if (isNestedFormat && updateCommandeDto.articles) {
            console.log('📝 ===== MISE À JOUR ARTICLES NESTED =====');
            const existingArticle = await this.prisma.article.findFirst({
                where: { commandeId: id }
            });

            if (existingArticle) {
                await this.prisma.article.update({
                    where: { id: existingArticle.id },
                    data: {
                        nombre: updateCommandeDto.articles.nombre,
                        details: updateCommandeDto.articles.details,
                        categories: updateCommandeDto.articles.categories,
                        dimensions: updateCommandeDto.articles.dimensions
                            ? JSON.stringify(updateCommandeDto.articles.dimensions)
                            : existingArticle.dimensions,
                        canBeTilted: updateCommandeDto.articles.canBeTilted !== undefined ?
                            updateCommandeDto.articles.canBeTilted : existingArticle.canBeTilted
                    }
                });
            }
        } else if (isFlatFormat && updateCommandeDto.nombreArticles) {
            console.log('📝 ===== MISE À JOUR ARTICLES FLAT =====');
            const existingArticle = await this.prisma.article.findFirst({
                where: { commandeId: id }
            });

            if (existingArticle) {
                await this.prisma.article.update({
                    where: { id: existingArticle.id },
                    data: {
                        nombre: updateCommandeDto.nombreArticles,
                        details: updateCommandeDto.detailsArticles,
                        categories: updateCommandeDto.categoriesArticles,
                        dimensions: updateCommandeDto.dimensionsArticles
                            ? JSON.stringify(updateCommandeDto.dimensionsArticles)
                            : existingArticle.dimensions,
                        canBeTilted: updateCommandeDto.canBeTilted !== undefined ?
                            updateCommandeDto.canBeTilted : existingArticle.canBeTilted
                    }
                });
            }
        }

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

            // ❌ RÈGLE MÉTIER DÉSACTIVÉE : Auto-confirmation créait interdépendance des dates
            // if (updateCommandeDto.statutLivraison === 'CONFIRMEE' && existingCommande.statutCommande !== 'Confirmée') {
            //     updateData.statutCommande = 'Confirmée';
            //     console.log('📊 Auto-confirmation commande déclenchée');
            // }
        }
        if (updateCommandeDto.remarques !== undefined) {
            updateData.remarques = updateCommandeDto.remarques;
        }
        if (updateCommandeDto.prenomVendeur !== undefined) {
            updateData.prenomVendeur = updateCommandeDto.prenomVendeur;
        }

        if (updateCommandeDto.deliveryConditions) {
            console.log('🚚 Mise à jour conditions livraison:', updateCommandeDto.deliveryConditions);

            const conditions = updateCommandeDto.deliveryConditions;

            // Mettre à jour champs individuels
            if (conditions.rueInaccessible !== undefined) {
                updateData.rueInaccessible = conditions.rueInaccessible;
            }
            if (conditions.paletteComplete !== undefined) {
                updateData.paletteComplete = conditions.paletteComplete;
            }
            if (conditions.parkingDistance !== undefined) {
                updateData.parkingDistance = conditions.parkingDistance;
            }
            if (conditions.hasStairs !== undefined) {
                updateData.hasStairs = conditions.hasStairs;
            }
            if (conditions.stairCount !== undefined) {
                updateData.stairCount = conditions.stairCount;
            }
            if (conditions.needsAssembly !== undefined) {
                updateData.needsAssembly = conditions.needsAssembly;
            }
            if (conditions.isDuplex !== undefined) {
                updateData.isDuplex = conditions.isDuplex;
            }
            if (conditions.deliveryToUpperFloor !== undefined) {
                updateData.deliveryToUpperFloor = conditions.deliveryToUpperFloor;
            }

            console.log('✅ Conditions mises à jour dans updateData:', {
                rueInaccessible: updateData.rueInaccessible,
                paletteComplete: updateData.paletteComplete,
                parkingDistance: updateData.parkingDistance,
                hasStairs: updateData.hasStairs,
                stairCount: updateData.stairCount,
                needsAssembly: updateData.needsAssembly,
                isDuplex: updateData.isDuplex,
                deliveryToUpperFloor: updateData.deliveryToUpperFloor
            });
        }

        // ✅ RECALCUL VALIDATION avec nouvelles conditions
        if (updateCommandeDto.deliveryConditions || updateCommandeDto.articles?.dimensions) {
            const articlesEquipiers = updateCommandeDto.articles?.dimensions || [];
            const deliveryConditions = {
                hasElevator: updateCommandeDto.client?.ascenseur || existingCommande.client?.ascenseur || false,
                totalItemCount: articlesEquipiers.reduce((sum, article) => sum + (article.quantite || 1), 0),
                rueInaccessible: updateData.rueInaccessible ?? existingCommande.rueInaccessible ?? false,
                paletteComplete: updateData.paletteComplete ?? existingCommande.paletteComplete ?? false,
                parkingDistance: updateData.parkingDistance ?? existingCommande.parkingDistance ?? 0,
                hasStairs: updateData.hasStairs ?? existingCommande.hasStairs ?? false,
                stairCount: updateData.stairCount ?? existingCommande.stairCount ?? 0,
                needsAssembly: updateData.needsAssembly ?? existingCommande.needsAssembly ?? false,
                isDuplex: updateData.isDuplex ?? existingCommande.isDuplex ?? false,
                deliveryToUpperFloor: updateData.deliveryToUpperFloor ?? existingCommande.deliveryToUpperFloor ?? false,
                floor: parseInt(updateCommandeDto.client?.etage || existingCommande.client?.etage || '0')
            };

            const validation = this.calculateDeliveryValidation(articlesEquipiers, deliveryConditions, updateCommandeDto);

            updateData.requiredCrewSize = validation.requiredCrewSize;
            updateData.heaviestArticleWeight = validation.heaviestArticleWeight;
            updateData.needsQuote = validation.needsQuote;
            updateData.validationDetails = JSON.stringify(validation.details);
            updateData.lastValidationAt = new Date();

            console.log('🔄 Validation recalculée:', {
                requiredCrewSize: validation.requiredCrewSize,
                needsQuote: validation.needsQuote
            });
        }

        // ✅ HISTORIQUE STATUTS : Détecter uniquement les changements directs (pas de règles métier)
        const statusChanges: Array<{
            statusType: 'COMMANDE' | 'LIVRAISON';
            oldStatus: string;
            newStatus: string;
        }> = [];

        if (updateCommandeDto.statutCommande !== undefined && updateCommandeDto.statutCommande !== existingCommande.statutCommande) {
            statusChanges.push({
                statusType: 'COMMANDE',
                oldStatus: existingCommande.statutCommande,
                newStatus: updateCommandeDto.statutCommande
            });
        }

        if (updateCommandeDto.statutLivraison !== undefined && updateCommandeDto.statutLivraison !== existingCommande.statutLivraison) {
            statusChanges.push({
                statusType: 'LIVRAISON',
                oldStatus: existingCommande.statutLivraison,
                newStatus: updateCommandeDto.statutLivraison
            });
        }

        // Mettre à jour seulement si il y a des données à modifier
        if (Object.keys(updateData).length > 0) {
            await this.prisma.commande.update({
                where: { id },
                data: updateData,
            });

            // ✅ CRÉER HISTORIQUE STATUTS après la mise à jour réussie
            for (const change of statusChanges) {
                await this.createStatusHistoryEntry(id, change, 'system'); // TODO: utiliser l'ID utilisateur réel
            }

            console.log('✅ Commande mise à jour avec conditions:', {
                id: id,
                updatedFields: Object.keys(updateData),
                statusChanges: statusChanges.length
            });

            console.log('📝 Champs commande mis à jour:', Object.keys(updateData));
        } else {
            console.log('📝 Aucune donnée à mettre à jour pour cette commande');
            this.logger.log(`📝 Aucune donnée à mettre à jour pour cette commande: ${existingCommande.numeroCommande}`);
        }

        // 🆕 GÉRER LA MISE À JOUR DU CRÉNEAU
        let timeSlotId: string | undefined = undefined;

        if (updateCommandeDto.creneauLivraison !== undefined) {
            if (updateCommandeDto.creneauLivraison) {
                // Trouver le nouveau créneau
                const timeSlot = await this.prisma.timeSlot.findFirst({
                    where: {
                        displayName: updateCommandeDto.creneauLivraison,
                        isActive: true
                    }
                });

                if (timeSlot) {
                    // Vérifier la disponibilité (en excluant cette commande)
                    const date = updateCommandeDto.dateLivraison ?
                        new Date(updateCommandeDto.dateLivraison).toISOString().split('T')[0] :
                        (await this.findOne(id)).dateLivraison.toISOString().split('T')[0];

                    const availability = await this.slotsService.getAvailabilityForDate(date);
                    const slotAvailability = availability.find(a => a.slot.id === timeSlot.id);

                    // Pour la mise à jour, on permet si le créneau n'est pas complet
                    // (il faut tenir compte que cette commande pourrait libérer une place)
                    if (slotAvailability && slotAvailability.bookingsCount < slotAvailability.maxCapacity) {
                        timeSlotId = timeSlot.id;
                    } else {
                        throw new BadRequestException('Créneau complet pour cette date');
                    }
                } else {
                    timeSlotId = null; // Créneau supprimé
                }
            } else {
                timeSlotId = null; // Créneau effacé
            }
            // Inclure dans les données de mise à jour si défini

            updateData.creneauLivraison = timeSlotId;
        }

        this.logger.log(`✅ Commande mise à jour: ${existingCommande.numeroCommande}`);

        // Retourner la commande mise à jour
        return this.findOne(id);
    }

    private calculateDeliveryValidation(
        articles: any[],
        deliveryConditions: any,
        commandeDto: any
    ) {
        const heaviestWeight = articles.length > 0 ?
            Math.max(...articles.map(a => a.poids || 0)) : 0;

        const totalWeight = articles.reduce((sum, article) =>
            sum + ((article.poids || 0) * (article.quantite || 1)), 0
        );

        const totalItems = articles.reduce((sum, article) =>
            sum + (article.quantite || 1), 0
        );

        // Calcul équipiers requis (même logique que frontend)
        let requiredCrewSize = 0;

        if (heaviestWeight >= 30) requiredCrewSize++;
        if (commandeDto.clientAscenseur && totalWeight > 300) requiredCrewSize++;
        if (!commandeDto.clientAscenseur && totalWeight > 200) requiredCrewSize++;
        if (totalItems > 20) requiredCrewSize++;
        if (deliveryConditions.rueInaccessible) requiredCrewSize++;
        if (deliveryConditions.paletteComplete) requiredCrewSize++;
        if ((deliveryConditions.parkingDistance || 0) > 50) requiredCrewSize++;

        const effectiveFloor = parseInt(commandeDto.clientEtage || '0') +
            (deliveryConditions.isDuplex && deliveryConditions.deliveryToUpperFloor ? 1 : 0);

        if (effectiveFloor > 2 && !commandeDto.clientAscenseur) requiredCrewSize++;
        if (deliveryConditions.hasStairs && (deliveryConditions.stairCount || 0) > 20) requiredCrewSize++;
        if (deliveryConditions.needsAssembly) requiredCrewSize++;

        const needsQuote = requiredCrewSize >= 3 || totalWeight > 800;

        return {
            requiredCrewSize,
            heaviestArticleWeight: heaviestWeight,
            needsQuote,
            details: {
                totalWeight,
                totalItems,
                effectiveFloor,
                conditions: deliveryConditions,
                calculatedAt: new Date().toISOString()
            }
        };
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
        this.logger.log(`🔍 findOrCreateClient: Recherche client ${clientData.nom} - ${clientData.telephone}`);
        
        // 🎯 RECHERCHE INTELLIGENTE: nom ET téléphone pour éviter doublons
        let client = await tx.client.findFirst({
            where: {
                nom: clientData.nom,
                telephone: clientData.telephone,
                // Ne pas chercher les clients supprimés
                deletionRequested: false
            },
        });

        // 📅 CALCUL DATE DE RÉTENTION (2 ans conformément RGPD)
        const futureRetentionDate = new Date();
        futureRetentionDate.setFullYear(futureRetentionDate.getFullYear() + 2);

        if (!client) {
            // 🆕 CRÉATION CLIENT AVEC DONNÉES COMPLÈTES PÉRENNES
            this.logger.log(`🆕 Création nouveau client: ${clientData.nom} ${clientData.prenom}`);
            
            client = await tx.client.create({
                data: {
                    nom: clientData.nom,
                    prenom: clientData.prenom || null,
                    telephone: clientData.telephone,
                    telephoneSecondaire: clientData.telephoneSecondaire || null,
                    adresseLigne1: clientData.adresseLigne1,
                    batiment: clientData.batiment || null,
                    etage: clientData.etage || null,
                    interphone: clientData.interphone || null,
                    ascenseur: clientData.ascenseur || false,
                    typeAdresse: clientData.typeAdresse || 'Domicile',
                    
                    // 🎯 CHAMPS CRITIQUES POUR VISIBILITÉ
                    dataRetentionUntil: futureRetentionDate,  // ✅ FIX: Date valide
                    deletionRequested: false,                 // ✅ FIX: Non supprimé
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
            });
            
            this.logger.log(`✅ Client créé avec succès: ${client.id} - ${client.nom} ${client.prenom}`);
            this.logger.log(`📅 Date de rétention: ${client.dataRetentionUntil.toISOString()}`);
            
        } else {
            // 🔄 MISE À JOUR INTELLIGENTE DU CLIENT EXISTANT
            this.logger.log(`🔄 Mise à jour client existant: ${client.id} - ${client.nom}`);
            
            // Vérifier si la date de rétention doit être mise à jour
            const needsRetentionUpdate = !client.dataRetentionUntil || client.dataRetentionUntil < new Date();
            
            client = await tx.client.update({
                where: { id: client.id },
                data: {
                    // Mettre à jour les informations si plus récentes
                    prenom: clientData.prenom || client.prenom,
                    telephoneSecondaire: clientData.telephoneSecondaire || client.telephoneSecondaire,
                    adresseLigne1: clientData.adresseLigne1 || client.adresseLigne1,
                    batiment: clientData.batiment || client.batiment,
                    etage: clientData.etage || client.etage,
                    interphone: clientData.interphone || client.interphone,
                    ascenseur: clientData.ascenseur ?? client.ascenseur,
                    typeAdresse: clientData.typeAdresse || client.typeAdresse,
                    
                    // 🎯 RENOUVELER LA RÉTENTION À CHAQUE COMMANDE
                    dataRetentionUntil: needsRetentionUpdate ? futureRetentionDate : client.dataRetentionUntil,
                    updatedAt: new Date()
                },
            });
            
            if (needsRetentionUpdate) {
                this.logger.log(`📅 Date de rétention mise à jour: ${client.dataRetentionUntil.toISOString()}`);
            }
        }

        // 🧪 VALIDATION FINALE
        if (!client.dataRetentionUntil || client.dataRetentionUntil < new Date()) {
            this.logger.error(`❌ PROBLÈME: Client ${client.id} a une date de rétention invalide`);
        } else {
            this.logger.log(`✅ Client prêt: ${client.id} - Visible jusqu'au ${client.dataRetentionUntil.toISOString().split('T')[0]}`);
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
        console.log(`📊 statutCommande dans updateData:`, updateData.statutCommande);
        console.log(`📊 statutLivraison dans updateData:`, updateData.statutLivraison);
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

                // ❌ RÈGLE 2 DÉSACTIVÉE : Auto-confirmation créait interdépendance des dates
                // if (updateData.statutLivraison === StatutLivraison.CONFIRMEE &&
                //     existingCommande.statutCommande !== StatutCommande.CONFIRMEE) {
                //     finalUpdateData.statutCommande = StatutCommande.CONFIRMEE;
                //     autoActions.push('Auto-confirmation commande déclenchée');
                // }

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
 * Créer un rapport d'enlèvement ou de livraison (1 seul par type)
 */
    async createRapport(
        commandeId: string,
        rapportData: CreateRapportDto,
        userId?: string
    ): Promise<any> {
        console.log(`📝 ===== CRÉATION RAPPORT SANS IMPACT STATUT =====`);
        console.log(`📝 Commande: ${commandeId}`);
        console.log(`📝 Type: ${rapportData.type}`);

        const existingCommande = await this.findOne(commandeId);

        return this.prisma.$transaction(async (tx) => {
            // ✅ CONTRAINTE : Vérifier qu'il n'y a pas déjà un rapport de ce type
            if (rapportData.type === TypeRapport.ENLEVEMENT) {
                const existingRapport = await tx.rapportEnlevement.findFirst({
                    where: { commandeId }
                });
                if (existingRapport) {
                    throw new BadRequestException('Un rapport d\'enlèvement existe déjà pour cette commande');
                }
            } else {
                const existingRapport = await tx.rapportLivraison.findFirst({
                    where: { commandeId }
                });
                if (existingRapport) {
                    throw new BadRequestException('Un rapport de livraison existe déjà pour cette commande');
                }
            }

            let rapport;

            if (rapportData.type === TypeRapport.ENLEVEMENT) {
                // Créer rapport d'enlèvement
                rapport = await tx.rapportEnlevement.create({
                    data: {
                        message: rapportData.message,
                        chauffeurId: rapportData.chauffeurId,
                        commandeId: commandeId
                    },
                    include: {
                        chauffeur: {
                            select: {
                                id: true,
                                nom: true,
                                prenom: true,
                                telephone: true
                            }
                        }
                    }
                });
            } else {
                // Créer rapport de livraison
                rapport = await tx.rapportLivraison.create({
                    data: {
                        message: rapportData.message,
                        chauffeurId: rapportData.chauffeurId,
                        commandeId: commandeId
                    },
                    include: {
                        chauffeur: {
                            select: {
                                id: true,
                                nom: true,
                                prenom: true,
                                telephone: true
                            }
                        }
                    }
                });
            }

            await tx.commande.update({
                where: { id: commandeId },
                data: {
                    reserveTransport: true
                }
            });

            // ✅ AJOUTER PHOTOS
            if (rapportData.photos && rapportData.photos.length > 0) {
                await tx.photo.createMany({
                    data: rapportData.photos.map(photo => ({
                        url: photo.url,
                        filename: photo.filename || photo.url.split('/').pop() || 'image',
                        commandeId: commandeId,
                        type: rapportData.type
                    }))
                });
            }

            console.log(`✅ Rapport ${rapportData.type} créé - Réserve activée - Statut inchangé`);
            this.logger.log(`📝 Rapport ${rapportData.type} créé pour commande ${existingCommande.numeroCommande} - Statut livraison préservé`);

            return rapport;
        });
    }

    /**
     * Vérifier si un rapport est obligatoire
     */
    async isRapportObligatoire(commandeId: string, type: TypeRapport): Promise<boolean> {
        const commande = await this.findOne(commandeId);

        if (type === TypeRapport.LIVRAISON) {
            // ✅ Obligatoire si statut ECHEC
            return commande.statutLivraison === 'ECHEC';
        }

        if (type === TypeRapport.ENLEVEMENT) {
            // ✅ OBLIGATOIRE si problème d'enlèvement mais statut ECHEC
            return commande.statutLivraison === 'ECHEC' &&
                !await this.hasRapportEnlevement(commandeId);
        }

        return false;
    }

    /**
 * Vérifier si un rapport d'enlèvement existe
 */
    private async hasRapportEnlevement(commandeId: string): Promise<boolean> {
        const rapport = await this.prisma.rapportEnlevement.findFirst({
            where: { commandeId }
        });
        return !!rapport;
    }

    /**
     * Récupérer tous les rapports d'une commande
     */
    async getRapportsCommande(commandeId: string): Promise<any> {
        const [rapportsEnlevement, rapportsLivraison, photos] = await Promise.all([
            this.prisma.rapportEnlevement.findMany({
                where: { commandeId },
                include: {
                    chauffeur: {
                        select: {
                            id: true,
                            nom: true,
                            prenom: true,
                            telephone: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            this.prisma.rapportLivraison.findMany({
                where: { commandeId },
                include: {
                    chauffeur: {
                        select: {
                            id: true,
                            nom: true,
                            prenom: true,
                            telephone: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            // ✅ Récupérer les photos des commentaires
            this.prisma.photo.findMany({
                where: {
                    commandeId,
                    type: { in: ['ENLEVEMENT', 'LIVRAISON'] }
                },
                orderBy: { createdAt: 'desc' }
            })
        ]);

        return {
            enlevement: rapportsEnlevement,
            livraison: rapportsLivraison,
            photos: {
                enlevement: photos.filter(p => p.type === 'ENLEVEMENT'),
                livraison: photos.filter(p => p.type === 'LIVRAISON')
            }
        };
    }

    /**
 * Mettre à jour un rapport existant
 */
    async updateRapport(
        commandeId: string,
        rapportType: TypeRapport,
        updateData: UpdateRapportDto,
        userId?: string
    ): Promise<any> {
        console.log(`📝 ===== MISE À JOUR RAPPORT =====`);
        console.log(`📝 Commande: ${commandeId}`);
        console.log(`📝 Type: ${rapportType}`);

        return this.prisma.$transaction(async (tx) => {
            let rapport;

            // ✅ Trouver le rapport existant
            if (rapportType === TypeRapport.ENLEVEMENT) {
                rapport = await tx.rapportEnlevement.findFirst({
                    where: { commandeId }
                });
                if (!rapport) {
                    throw new NotFoundException('Rapport d\'enlèvement non trouvé');
                }

                // Mettre à jour le message si fourni
                if (updateData.message) {
                    rapport = await tx.rapportEnlevement.update({
                        where: { id: rapport.id },
                        data: { message: updateData.message },
                        include: {
                            chauffeur: {
                                select: {
                                    id: true,
                                    nom: true,
                                    prenom: true,
                                    telephone: true
                                }
                            }
                        }
                    });
                }
            } else {
                rapport = await tx.rapportLivraison.findFirst({
                    where: { commandeId }
                });
                if (!rapport) {
                    throw new NotFoundException('Rapport de livraison non trouvé');
                }

                // Mettre à jour le message si fourni
                if (updateData.message) {
                    rapport = await tx.rapportLivraison.update({
                        where: { id: rapport.id },
                        data: { message: updateData.message },
                        include: {
                            chauffeur: {
                                select: {
                                    id: true,
                                    nom: true,
                                    prenom: true,
                                    telephone: true
                                }
                            }
                        }
                    });
                }
            }

            // ✅ SUPPRIMER les photos demandées
            if (updateData.photosToRemove && updateData.photosToRemove.length > 0) {
                await tx.photo.deleteMany({
                    where: {
                        commandeId,
                        type: rapportType,
                        url: { in: updateData.photosToRemove }
                    }
                });
            }

            // ✅ AJOUTER les nouvelles photos
            if (updateData.newPhotos && updateData.newPhotos.length > 0) {
                await tx.photo.createMany({
                    data: updateData.newPhotos.map(photo => ({
                        url: photo.url,
                        filename: photo.filename || photo.url.split('/').pop() || 'image',
                        commandeId: commandeId,
                        type: rapportType
                    }))
                });
            }

            console.log(`✅ Rapport ${rapportType} mis à jour`);

            return rapport;
        });
    }

    async deleteRapport(
        commandeId: string,
        rapportType: TypeRapport,
        userId?: string
    ): Promise<void> {
        console.log(`📝 ===== SUPPRESSION RAPPORT + VÉRIF RÉSERVE =====`);

        return this.prisma.$transaction(async (tx) => {
            // ✅ VÉRIFIER s'il reste d'autres rapports après suppression
            const [autresRapportsEnlevement, autresRapportsLivraison] = await Promise.all([
                rapportType === TypeRapport.ENLEVEMENT
                    ? Promise.resolve([]) // On supprime celui-ci, donc 0
                    : tx.rapportEnlevement.findMany({ where: { commandeId } }),

                rapportType === TypeRapport.LIVRAISON
                    ? Promise.resolve([]) // On supprime celui-ci, donc 0
                    : tx.rapportLivraison.findMany({ where: { commandeId } })
            ]);

            const hasRemainingReports = autresRapportsEnlevement.length > 0 || autresRapportsLivraison.length > 0;

            // Supprimer les photos associées
            await tx.photo.deleteMany({
                where: {
                    commandeId,
                    type: rapportType
                }
            });

            // Supprimer le rapport
            if (rapportType === TypeRapport.ENLEVEMENT) {
                await tx.rapportEnlevement.deleteMany({
                    where: { commandeId }
                });
            } else {
                await tx.rapportLivraison.deleteMany({
                    where: { commandeId }
                });
            }

            // ✅ RÉSERVE : Si plus aucun rapport, remettre à false
            if (!hasRemainingReports) {
                await tx.commande.update({
                    where: { id: commandeId },
                    data: { reserveTransport: false }
                });
                console.log('✅ Plus de rapports → Réserve My Truck désactivée');
            } else {
                console.log('✅ Rapports restants → Réserve My Truck maintenue');
            }

            console.log(`✅ Rapport ${rapportType} supprimé`);
        });
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

    /**
     * ✅ NOUVELLE MÉTHODE : Créer une entrée d'historique des statuts
     */
    private async createStatusHistoryEntry(
        commandeId: string, 
        change: { statusType: 'COMMANDE' | 'LIVRAISON'; oldStatus: string; newStatus: string },
        changedBy: string,
        reason?: string
    ) {
        try {
            await this.prisma.statusHistory.create({
                data: {
                    commandeId,
                    statusType: change.statusType,
                    oldStatus: change.oldStatus,
                    newStatus: change.newStatus,
                    changedBy,
                    reason
                }
            });
            
            console.log(`📊 Historique créé: ${change.statusType} ${change.oldStatus} → ${change.newStatus}`);
        } catch (error) {
            console.error('❌ Erreur création historique statut:', error);
            // Ne pas faire échouer la transaction principale
        }
    }
}