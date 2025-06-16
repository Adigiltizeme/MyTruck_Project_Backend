import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMagasinDto, UpdateMagasinDto } from './dto';

@Injectable()
export class MagasinsService {
    private readonly logger = new Logger(MagasinsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(params: {
        skip?: number;
        take?: number;
        where?: any; // Utilisation d'any temporairement
        orderBy?: any;
    }) {
        const { skip, take, where, orderBy } = params;

        return this.prisma.magasin.findMany({
            skip,
            take,
            where,
            orderBy: orderBy || { nom: 'asc' },
            include: {
                _count: {
                    select: {
                        users: true,
                        commandes: true,
                    },
                },
            },
        });
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

        return magasin;
    }

    async create(createMagasinDto: CreateMagasinDto) {
        const magasin = await this.prisma.magasin.create({
            data: {
                ...createMagasinDto,
                categories: createMagasinDto.categories || [],
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

        this.logger.log(`✅ Magasin créé: ${magasin.nom}`);
        return magasin;
    }

    async update(id: string, updateMagasinDto: UpdateMagasinDto) {
        await this.findOne(id); // Vérifier que le magasin existe

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

        this.logger.log(`✅ Magasin mis à jour: ${magasin.nom}`);
        return magasin;
    }

    async remove(id: string) {
        const existingMagasin = await this.findOne(id);

        // Vérifier les dépendances
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
            throw new Error(
                `Impossible de supprimer le magasin car il contient des données liées (${totalDependencies} éléments)`
            );
        }

        await this.prisma.magasin.delete({
            where: { id },
        });

        this.logger.log(`✅ Magasin supprimé: ${existingMagasin.nom}`);
        return { message: 'Magasin supprimé avec succès' };
    }

    async findByStatus(status: string) {
        return this.prisma.magasin.findMany({
            where: { status },
            include: {
                _count: {
                    select: {
                        users: true,
                        commandes: true,
                    },
                },
            },
        });
    }

    async getStats(id: string) {
        const magasin = await this.findOne(id);

        const stats = await this.prisma.magasin.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        commandes: true,
                        factures: true,
                        devis: true,
                        cessionsOrigine: true,
                        cessionsDestination: true,
                    },
                },
            },
        });

        // Statistiques des commandes par statut
        const commandesStats = await this.prisma.commande.groupBy({
            by: ['statutCommande'],
            where: { magasinId: id },
            _count: {
                statutCommande: true,
            },
        });

        // Statistiques des livraisons par statut
        const livraisonsStats = await this.prisma.commande.groupBy({
            by: ['statutLivraison'],
            where: { magasinId: id },
            _count: {
                statutLivraison: true,
            },
        });

        return {
            magasin: {
                id: magasin.id,
                nom: magasin.nom,
            },
            totaux: stats._count,
            commandes: {
                parStatut: commandesStats.map(stat => ({
                    statut: stat.statutCommande,
                    nombre: stat._count.statutCommande,
                })),
            },
            livraisons: {
                parStatut: livraisonsStats.map(stat => ({
                    statut: stat.statutLivraison,
                    nombre: stat._count.statutLivraison,
                })),
            },
        };
    }
}