import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TrackingEventType } from '@prisma/client';

@Injectable()
export class TrackingService {
    constructor(private prisma: PrismaService) { }

    async createTrackingEvent(data: {
        commandeId: string;
        eventType: TrackingEventType;
        latitude?: number;
        longitude?: number;
        metadata?: any;
    }) {
        return this.prisma.trackingEvent.create({
            data,
        });
    }

    async getCommandeTracking(commandeId: string) {
        return this.prisma.trackingEvent.findMany({
            where: { commandeId },
            orderBy: { timestamp: 'desc' },
        });
    }

    async updateChauffeurPosition(
        chauffeurId: string,
        latitude: number,
        longitude: number,
    ) {
        // Mettre à jour la position du chauffeur
        const chauffeur = await this.prisma.chauffeur.update({
            where: { id: chauffeurId },
            data: { latitude, longitude },
        });

        // Créer un événement de tracking pour toutes ses commandes actives
        const commandesActives = await this.prisma.commande.findMany({
            where: {
                chauffeurs: {
                    some: { chauffeurId }
                },
                statutLivraison: {
                    in: ['EN COURS', 'EN ROUTE']
                }
            }
        });

        // Créer des événements de position pour chaque commande active
        await Promise.all(
            commandesActives.map(commande =>
                this.createTrackingEvent({
                    commandeId: commande.id,
                    eventType: TrackingEventType.POSITION_UPDATE,
                    latitude,
                    longitude,
                    metadata: { chauffeurId }
                })
            )
        );

        return chauffeur;
    }

    // MÉTHODE MANQUANTE - À AJOUTER
    async updateCommandeStatus(
        commandeId: string,
        newStatus: string,
        changedBy: string,
        reason?: string
    ) {
        const commande = await this.prisma.commande.findUnique({
            where: { id: commandeId }
        });

        if (!commande) {
            throw new Error('Commande not found');
        }

        // Créer l'historique de statut
        await this.prisma.statusHistory.create({
            data: {
                commandeId,
                oldStatus: commande.statutLivraison,
                newStatus,
                changedBy,
                reason
            }
        });

        // Mettre à jour la commande
        return this.prisma.commande.update({
            where: { id: commandeId },
            data: { statutLivraison: newStatus }
        });
    }
}