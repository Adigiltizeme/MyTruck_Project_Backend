import { Injectable } from "@nestjs/common";
import { PrismaService } from "prisma/prisma.service";

@Injectable()
export class GDPRComplianceService {
    constructor(private readonly prisma: PrismaService) { }

    // Vérifier les droits d'accès selon le rôle
    canViewClient(userRole: string, clientId: string): boolean {
        const allowedRoles = ['ADMIN', 'DIRECTION', 'MAGASIN'];
        return allowedRoles.includes(userRole);
    }

    // Pseudonymiser les données sensibles
    pseudonymizeClientData(client: any) {
        return {
            ...client,
            nom: this.pseudonymizeString(client.nom),
            prenom: client.prenom ? this.pseudonymizeString(client.prenom) : null,
            telephone: this.pseudonymizePhone(client.telephone),
            telephoneSecondaire: client.telephoneSecondaire ?
                this.pseudonymizePhone(client.telephoneSecondaire) : null,
            adresseLigne1: this.pseudonymizeAddress(client.adresseLigne1),
            email: client.email ? this.pseudonymizeEmail(client.email) : null
        };
    }

    // Calculer la date limite de conservation (3 ans après dernière commande)
    calculateRetentionDate(lastActivityAt: Date): Date {
        const retentionDate = new Date(lastActivityAt);
        retentionDate.setFullYear(retentionDate.getFullYear() + 3);
        return retentionDate;
    }

    // Vérifier si les données doivent être supprimées
    async checkDataRetention() {
        const now = new Date();
        const expiredClients = await this.prisma.client.findMany({
            where: {
                dataRetentionUntil: { lte: now },
                deletionRequested: false,
                pseudonymized: false
            }
        });

        for (const client of expiredClients) {
            await this.anonymizeOrDeleteClient(client.id);
        }
    }

    // Méthode pour anonymiser ou supprimer un client
    private async anonymizeOrDeleteClient(clientId: string): Promise<void> {
        // Exemple d'anonymisation : pseudonymiser les données et marquer comme pseudonymisé
        await this.prisma.client.update({
            where: { id: clientId },
            data: {
                nom: 'Anonyme',
                prenom: null,
                telephone: null,
                telephoneSecondaire: null,
                adresseLigne1: null
            }
        });
        // Si suppression totale requise, utilisez delete à la place
        // await this.prisma.client.delete({ where: { id: clientId } });
    }

    private pseudonymizeString(value: string): string {
        return value.substring(0, 2) + '***';
    }

    private pseudonymizePhone(phone: string): string {
        return phone.substring(0, 4) + '***' + phone.slice(-2);
    }

    private pseudonymizeEmail(email: string): string {
        const [local, domain] = email.split('@');
        return local.substring(0, 2) + '***@' + domain;
    }

    private pseudonymizeAddress(address: string): string {
        return 'Adresse masquée';
    }
}