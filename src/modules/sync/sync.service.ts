import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export enum SyncDirection {
    DB_TO_AIRTABLE = 'db_to_airtable',
    AIRTABLE_TO_DB = 'airtable_to_db',
    BIDIRECTIONAL = 'bidirectional',
    READ_ONLY = 'read_only'
}

interface SyncConfig {
    [tableName: string]: {
        direction: SyncDirection;
        priority: 'DB' | 'AIRTABLE' | 'TIMESTAMP';
        frequency: string; // cron expression
        critical: boolean;
    };
}

@Injectable()
export class SyncService {
    private readonly logger = new Logger(SyncService.name);

    constructor(private prisma: PrismaService) { }

    private readonly syncConfig: SyncConfig = {
        commandes: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/2 * * * *', // Toutes les 2 minutes
            critical: true,
        },
        clients: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/5 * * * *', // Toutes les 5 minutes
            critical: true,
        },
        chauffeurs: {
            direction: SyncDirection.BIDIRECTIONAL,
            priority: 'DB',
            frequency: '*/10 * * * *', // Toutes les 10 minutes
            critical: false,
        },
        magasins: {
            direction: SyncDirection.BIDIRECTIONAL,
            priority: 'DB',
            frequency: '*/15 * * * *', // Toutes les 15 minutes
            critical: false,
        },
        // Tables critiques en lecture seule pour Airtable
        trackingEvents: {
            direction: SyncDirection.READ_ONLY,
            priority: 'DB',
            frequency: '*/1 * * * *', // Chaque minute
            critical: true,
        },
    };

    // Synchronisation différentielle - seulement les changements
    async syncToAirtable(tableName: string, force = false) {
        const config = this.syncConfig[tableName];
        if (!config) return;

        try {
            // Récupérer les enregistrements modifiés depuis la dernière sync
            const lastSync = await this.getLastSyncTimestamp(tableName);
            const modifiedRecords = await this.getModifiedRecords(tableName, lastSync);

            if (modifiedRecords.length === 0 && !force) {
                this.logger.debug(`📊 Aucune modification pour ${tableName}`);
                return;
            }

            // Synchroniser vers Airtable
            const results = await this.pushToAirtable(tableName, modifiedRecords);

            // Mettre à jour le timestamp de sync
            await this.updateSyncTimestamp(tableName);

            this.logger.log(`✅ Sync ${tableName}: ${results.length} enregistrements`);

        } catch (error) {
            this.logger.error(`❌ Erreur sync ${tableName}:`, error);

            // Alertes pour les tables critiques
            if (config.critical) {
                await this.sendCriticalSyncAlert(tableName, error);
            }
        }
    }

    // Synchronisation bidirectionnelle avec résolution de conflits
    async bidirectionalSync(tableName: string) {
        const config = this.syncConfig[tableName];
        if (config.direction !== SyncDirection.BIDIRECTIONAL) return;

        try {
            // 1. Sync DB → Airtable
            await this.syncToAirtable(tableName);

            // 2. Récupérer modifications Airtable
            const airtableChanges = await this.getAirtableChanges(tableName);

            if (airtableChanges.length === 0) return;

            // 3. Résolution des conflits
            const resolvedChanges = await this.resolveConflicts(
                tableName,
                airtableChanges,
                config.priority
            );

            // 4. Appliquer les changements acceptés
            await this.applyChangesToDB(tableName, resolvedChanges);

            this.logger.log(`🔄 Sync bidirectionnelle ${tableName}: ${resolvedChanges.length} changements appliqués`);

        } catch (error) {
            this.logger.error(`❌ Erreur sync bidirectionnelle ${tableName}:`, error);
        }
    }

    // Méthodes utilitaires
    private async getModifiedRecords(tableName: string, since: Date) {
        // Requête générique basée sur updatedAt
        return this.prisma[tableName].findMany({
            where: {
                updatedAt: { gt: since }
            }
        });
    }

    private async resolveConflicts(tableName: string, changes: any[], priority: string) {
        // Stratégie de résolution selon la priorité
        return changes.filter(change => {
            if (priority === 'DB') {
                // Rejeter si modifié côté DB plus récemment
                return change.airtableUpdated > change.dbUpdated;
            }
            return true; // Accepter par défaut
        });
    }

    // Tâches planifiées
    @Cron('*/2 * * * *') // Toutes les 2 minutes
    async syncCriticalTables() {
        const criticalTables = Object.entries(this.syncConfig)
            .filter(([_, config]) => config.critical)
            .map(([tableName]) => tableName);

        for (const tableName of criticalTables) {
            await this.syncToAirtable(tableName);
        }
    }

    @Cron('*/10 * * * *') // Toutes les 10 minutes
    async syncBidirectionalTables() {
        const bidirectionalTables = Object.entries(this.syncConfig)
            .filter(([_, config]) => config.direction === SyncDirection.BIDIRECTIONAL)
            .map(([tableName]) => tableName);

        for (const tableName of bidirectionalTables) {
            await this.bidirectionalSync(tableName);
        }
    }

    // Appliquer les changements résolus à la base de données
    private async applyChangesToDB(tableName: string, changes: any[]): Promise<void> {
        // Exemple générique : mettre à jour ou insérer chaque enregistrement
        for (const change of changes) {
            await this.prisma[tableName].upsert({
                where: { id: change.id },
                update: change,
                create: change,
            });
        }
    }

    // Méthodes à implémenter selon votre API Airtable
    private async pushToAirtable(tableName: string, records: any[]): Promise<any[]> {
        // Votre logique d'envoi vers Airtable
        // Exemple : retourner les enregistrements envoyés ou les réponses d'Airtable
        return [];
    }

    private async getAirtableChanges(tableName: string): Promise<any[]> {
        // Votre logique de récupération Airtable
        return [];
    }

    private async getLastSyncTimestamp(tableName: string): Promise<Date> {
        // Récupérer depuis une table de sync
        const syncRecord = await this.prisma.syncLog.findFirst({
            where: { tableName },
            orderBy: { lastSync: 'desc' }
        });
        return syncRecord?.lastSync || new Date(0);
    }

    private async updateSyncTimestamp(tableName: string) {
        await this.prisma.syncLog.upsert({
            where: { tableName },
            create: { tableName, lastSync: new Date() },
            update: { lastSync: new Date() }
        });
    }

    private async sendCriticalSyncAlert(tableName: string, error: any) {
        // Notifier par email/Slack en cas d'erreur critique
        this.logger.error(`🚨 ALERTE CRITIQUE: Échec sync ${tableName}`, error);
    }
}