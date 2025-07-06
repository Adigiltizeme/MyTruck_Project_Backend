import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface NotificationData {
    userId: string;
    title: string;
    message: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    commandeId?: string;
    metadata?: any;
}

@Injectable()
export class NotificationsService {
    constructor(private prisma: PrismaService) { }

    async createNotification(data: NotificationData) {
        // Ici on pourrait stocker en base si besoin
        // Pour l'instant, on utilise les WebSockets directement
        return data;
    }

    async sendPushNotification(userId: string, notification: NotificationData) {
        // Intégration avec service push (Firebase, OneSignal, etc.)
        console.log(`Sending push to ${userId}:`, notification);
    }

    async sendEmailNotification(email: string, subject: string, content: string) {
        // Intégration avec service email (SendGrid, Mailgun, etc.)
        console.log(`Sending email to ${email}:`, subject);
    }

    async notifyStatusChange(commandeId: string, oldStatus: string, newStatus: string) {
        const commande = await this.prisma.commande.findUnique({
            where: { id: commandeId },
            include: {
                client: true,
                magasin: true,
                chauffeurs: {
                    include: { chauffeur: true },
                },
            },
        });

        if (!commande) return;

        const notification: NotificationData = {
            userId: commande.client.id,
            title: 'Mise à jour de votre commande',
            message: `Votre commande ${commande.numeroCommande} est maintenant ${newStatus}`,
            type: 'INFO',
            commandeId,
        };

        // Notifier le client
        await this.sendPushNotification(commande.client.id, notification);

        // Notifier le magasin
        const magasinNotification = {
            ...notification,
            userId: commande.magasinId,
            title: 'Mise à jour commande',
        };
        await this.sendPushNotification(commande.magasinId, magasinNotification);
    }
}