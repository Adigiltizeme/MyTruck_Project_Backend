import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto, ClientFiltersDto } from './dto';
import { ClientsListResponseDto } from './dto/client-response.dto';
import { Prisma, Client as PrismaClientType } from '@prisma/client';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly prisma: PrismaService) { }

  async findAll(filters: ClientFiltersDto, userRole: string = 'MAGASIN', magasinId?: string) {
    console.log('🏪 Service findAll appelé avec role:', userRole, 'magasinId:', magasinId);

    const { skip, take, nom, ville, typeAdresse } = filters;

    const where: Prisma.ClientWhereInput = {
      deletionRequested: false,
      dataRetentionUntil: { gte: new Date() }
    };

    // 🔧 CORRECTION CRITIQUE : Filtrage par magasin
    if (userRole === 'MAGASIN' && magasinId) {
      console.log('🏪 Filtrage par magasin:', magasinId);

      // ✅ SOLUTION : Utiliser exists au lieu de some
      where.commandes = {
        some: {
          magasinId: magasinId,
          // ✅ AJOUT : S'assurer que le client a au moins une commande
          AND: [
            { magasinId: { equals: magasinId } }
          ]
        }
      };
    } else if (userRole === 'ADMIN' || userRole === 'DIRECTION') {
      console.log('👑 Admin: vue globale de tous les clients');
      // Pas de filtrage pour les admins
    } else {
      console.log('⚠️ Rôle non reconnu, filtrage restrictif');
      // Sécurité : si rôle non reconnu, ne rien afficher
      where.id = { equals: 'non-existent' };
    }

    // 🔧 AJOUT : Filtres additionnels
    if (nom) {
      where.OR = [
        { nom: { contains: nom, mode: 'insensitive' } },
        { prenom: { contains: nom, mode: 'insensitive' } }
      ];
    }

    if (typeAdresse) {
      where.typeAdresse = typeAdresse;
    }

    // 🔧 AMÉLIORATION : Include conditionnel selon rôle
    const includeConfig = {
      _count: {
        select: {
          commandes: userRole === 'MAGASIN'
            ? { where: { magasinId } }  // Compter seulement les commandes du magasin
            : true  // Compter toutes les commandes pour admin
        }
      },
      // Pour les admins, inclure info des magasins
      ...(userRole === 'ADMIN' && {
        commandes: {
          select: {
            magasinId: true,
            magasin: {
              select: { id: true, nom: true }
            }
          },
          distinct: ['magasinId' as Prisma.CommandeScalarFieldEnum],
          take: 5
        }
      })
    };

    try {
      const [clients, total] = await Promise.all([
        this.prisma.client.findMany({
          where,
          skip: skip || 0,
          take: take || 50,
          orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
          include: includeConfig,
        }),
        this.prisma.client.count({ where }),
      ]);

      console.log(`📊 Résultats: ${clients.length} clients trouvés sur ${total} total`);

      // ✅ ASSOUPLISSEMENT RGPD : Données complètes pour tous
      const processedClients = clients; // Pas de pseudonymisation

      return {
        data: processedClients,
        meta: {
          total,
          skip: skip || 0,
          take: take || 50,
          hasMore: (skip || 0) + (take || 50) < total,
          userRole,
          magasinId
        },
      };

    } catch (error) {
      console.error('❌ Erreur filtrage clients:', error);
      throw new Error(`Erreur lors de la récupération des clients: ${error.message}`);
    }
  }

  // ✅ RGPD ASSOUPLI : Méthode de pseudonymisation supprimée

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        commandes: {
          orderBy: { dateCommande: 'desc' },
          take: 10, // Dernières 10 commandes
          select: {
            id: true,
            numeroCommande: true,
            dateCommande: true,
            dateLivraison: true,
            statutCommande: true,
            statutLivraison: true,
            tarifHT: true,
            magasin: {
              select: {
                nom: true,
              },
            },
          },
        },
        _count: {
          select: {
            commandes: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client avec l'ID ${id} non trouvé`);
    }

    return client;
  }

  async create(createClientDto: CreateClientDto) {
    const client = await this.prisma.client.create({
      data: createClientDto,
      include: {
        _count: {
          select: {
            commandes: true,
          },
        },
      },
    });

    this.logger.log(`✅ Client créé: ${client.nom} ${client.prenom} (${client.id})`);
    return client;
  }

  async update(id: string, updateClientDto: UpdateClientDto) {
    // Vérifier que le client existe
    await this.findOne(id);

    const client = await this.prisma.client.update({
      where: { id },
      data: updateClientDto,
      include: {
        _count: {
          select: {
            commandes: true,
          },
        },
      },
    });

    this.logger.log(`✅ Client mis à jour: ${client.nom} ${client.prenom} (${client.id})`);
    return client;
  }

  async remove(id: string) {
    const existingClient = await this.findOne(id);

    // Vérifier qu'il n'y a pas de commandes associées
    if (existingClient._count.commandes > 0) {
      throw new Error(
        `Impossible de supprimer le client car il a ${existingClient._count.commandes} commande(s) associée(s)`
      );
    }

    await this.prisma.client.delete({
      where: { id },
    });

    this.logger.log(`🗑️ Client supprimé: ${existingClient.nom} ${existingClient.prenom}`);
    return { message: 'Client supprimé avec succès' };
  }

  async findByPhone(telephone: string) {
    return this.prisma.client.findMany({
      where: {
        OR: [
          { telephone },
          { telephoneSecondaire: telephone },
        ],
      },
      include: {
        _count: {
          select: {
            commandes: true,
          },
        },
      },
    });
  }

  async searchClients(searchTerm: string) {
    return this.prisma.client.findMany({
      where: {
        OR: [
          {
            nom: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            prenom: {
              contains: searchTerm,
              mode: 'insensitive',
            },
          },
          {
            telephone: {
              contains: searchTerm,
            },
          },
        ],
      },
      take: 20,
      include: {
        _count: {
          select: {
            commandes: true,
          },
        },
      },
    });
  }

  async getClientStats(id: string) {
    const client = await this.findOne(id);

    const [
      totalCommandes,
      commandesParStatut,
      derniereCommande,
      chiffreAffaireTotal,
    ] = await Promise.all([
      // Total des commandes
      this.prisma.commande.count({
        where: { clientId: id },
      }),

      // Commandes par statut
      this.prisma.commande.groupBy({
        by: ['statutCommande'],
        where: { clientId: id },
        _count: { statutCommande: true },
      }),

      // Dernière commande
      this.prisma.commande.findFirst({
        where: { clientId: id },
        orderBy: { dateCommande: 'desc' },
        select: {
          numeroCommande: true,
          dateCommande: true,
          statutCommande: true,
          statutLivraison: true,
        },
      }),

      // Chiffre d'affaire total
      this.prisma.commande.aggregate({
        where: { clientId: id },
        _sum: { tarifHT: true },
      }),
    ]);

    return {
      client: {
        id: client.id,
        nom: client.nom,
        prenom: client.prenom,
      },
      totaux: {
        commandes: totalCommandes,
        chiffreAffaireHT: chiffreAffaireTotal._sum.tarifHT || 0,
      },
      derniereCommande,
      repartition: {
        parStatutCommande: commandesParStatut.map(stat => ({
          statut: stat.statutCommande,
          nombre: stat._count.statutCommande,
        })),
      },
    };
  }
}