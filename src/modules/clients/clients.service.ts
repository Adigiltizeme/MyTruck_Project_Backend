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

    // Filtrage par magasin : seulement pour les magasins, les admins voient tout
    if (userRole === 'MAGASIN' && magasinId) {
      console.log('🏪 Filtrage par magasin:', magasinId);
      where.commandes = {
        some: {
          magasinId: magasinId
        }
      };
    } else {
      console.log('👑 Admin: vue globale de tous les clients');
    }

    if (nom) {
      where.nom = {
        contains: nom,
        mode: 'insensitive',
      };
    }

    if (typeAdresse) {
      where.typeAdresse = typeAdresse;
    }

    // Configuration de l'include selon le rôle
    const includeConfig = {
      _count: {
        select: {
          commandes: true,
        },
      },
      // Pour les admins, inclure les info des magasins via les commandes
      ...(userRole === 'ADMIN' && {
        commandes: {
          select: {
            magasinId: true,
            magasin: {
              select: {
                id: true,
                nom: true
              }
            }
          },
          distinct: ['magasinId'] as Prisma.CommandeScalarFieldEnum[],
          take: 10 // Limiter pour éviter trop de données
        }
      })
    };

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

    // Pseudonymiser selon les droits utilisateur
    const processedClients = userRole === 'MAGASIN'
      ? clients.map(client => {
        console.log('🔒 Pseudonymisation client:', client.nom);
        return this.pseudonymizeClientData(client);
      })
      : clients.map(client => {
        console.log('✅ Client complet affiché:', client.nom);
        return client;
      });

    return {
      data: processedClients,
      meta: {
        total,
        skip: skip || 0,
        take: take || 50,
        hasMore: (skip || 0) + (take || 50) < total,
      },
    };
  }

  private pseudonymizeClientData(client: any) {
    return {
      ...client,
      nom: client.nom.substring(0, 2) + '***',
      prenom: client.prenom ? client.prenom.substring(0, 2) + '***' : null,
      telephone: client.telephone ? client.telephone.substring(0, 4) + '***' + client.telephone.slice(-2) : null,
      telephoneSecondaire: client.telephoneSecondaire ? client.telephoneSecondaire.substring(0, 4) + '***' + client.telephoneSecondaire.slice(-2) : null,
      adresseLigne1: 'Adresse masquée',
      pseudonymized: true
    };
  }

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