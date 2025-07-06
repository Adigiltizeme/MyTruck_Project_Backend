import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateChauffeurDto, UpdateChauffeurDto, ChauffeurFiltersDto } from './dto';
import { Prisma } from '@prisma/client';
import { TrackingService } from '../tracking/tracking.service';

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
                include: {
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

        return {
            data: chauffeurs,
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
                                        ville: true,
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
        const chauffeur = await this.prisma.chauffeur.create({
            data: createChauffeurDto,
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

        this.logger.log(`✅ Chauffeur créé: ${chauffeur.nom} ${chauffeur.prenom} (${chauffeur.id})`);
        return chauffeur;
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

    async remove(id: string) {
        const existingChauffeur = await this.findOne(id);

        // Vérifier qu'il n'y a pas d'assignations actives
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
            throw new Error(
                `Impossible de supprimer le chauffeur car il a ${assignationsActives} assignation(s) active(s)`
            );
        }

        await this.prisma.chauffeur.delete({
            where: { id },
        });

        this.logger.log(`🗑️ Chauffeur supprimé: ${existingChauffeur.nom} ${existingChauffeur.prenom}`);
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
                                    ville: true,
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
}