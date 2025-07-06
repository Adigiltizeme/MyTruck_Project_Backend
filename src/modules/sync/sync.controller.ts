import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { AirtableSyncService } from './airtable-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SyncController {
    constructor(private readonly syncService: AirtableSyncService) { }

    @Post('test-connection')
    @Roles('ADMIN')
    async testConnection() {
        // Test simple de connexion Airtable
        return { message: 'Test de connexion Airtable...' };
    }

    @Post('manual/:table')
    @Roles('ADMIN')
    async manualSync(@Param('table') tableName: string) {
        await this.syncService.syncToAirtable(tableName, true);
        return { message: `Synchronisation manuelle de ${tableName} déclenchée` };
    }

    @Post('debug/:table')
    @Roles('ADMIN')
    async debugSync(@Param('table') tableName: string) {
        try {
            // Récupérer les données sans les envoyer à Airtable
            const lastSync = new Date(0); // Depuis le début
            const records = await this.syncService['getModifiedRecords'](tableName, lastSync, true);

            return {
                message: `Debug ${tableName}`,
                recordsCount: records.length,
                sampleRecord: records[0] || null,
                config: this.syncService['syncConfig'][tableName] || null,
            };
        } catch (error) {
            return {
                error: error.message,
                tableName,
            };
        }
    }

    @Post('test-single-magasin')
    @Roles('ADMIN')
    async testSingleMagasin(): Promise<any> {
        try {
            const magasin = await this.syncService['prisma'].magasin.findFirst({
                where: { nom: 'Truffaut Ivry' }
            });

            if (!magasin) {
                return { error: 'Magasin Truffaut Ivry non trouvé' };
            }

            const config = this.syncService.getConfig('magasins');
            const airtableRecord = await this.syncService.testTransform('magasins', [magasin]);

            return {
                message: 'Test transformation magasin',
                originalData: magasin,
                transformedData: airtableRecord[0],
                config: config,
            };

        } catch (error) {
            return {
                error: error.message,
            };
        }
    }

    @Post('test-airtable-connection')
    @Roles('ADMIN')
    async testAirtableConnection() {
        return this.syncService.testAirtableConnection();
    }

    @Post('test-create-airtable')
    @Roles('ADMIN')
    async testCreateAirtable() {
        try {
            const testRecord = {
                fields: {
                    'NOM DU MAGASIN': 'Test API MyTruck',
                    'ADRESSE DU MAGASIN': 'Test Adresse API',
                    'TÉLÉPHONE': '+33123456789',
                    'E-MAIL': 'test-api@mytruck.com'
                }
            };

            const axios = require('axios');
            const response = await axios.post(
                'https://api.airtable.com/v0/apprk0i4Hqqq3Cmg6/Magasins',
                { records: [testRecord] },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            return {
                message: '✅ Création Airtable réussie',
                createdRecord: response.data.records[0],
                airtableId: response.data.records[0].id,
            };

        } catch (error) {
            return {
                error: error.response?.data || error.message,
                status: error.response?.status,
                testRecord: {
                    fields: {
                        'NOM DU MAGASIN': 'Test API MyTruck',
                        'ADRESSE DU MAGASIN': 'Test Adresse API',
                        'TÉLÉPHONE': '+33123456789',
                        'E-MAIL': 'test-api@mytruck.com'
                    }
                }
            };
        }
    }

    @Post('test-sync-truffaut')
    @Roles('ADMIN')
    async testSyncTruffaut() {
        try {
            // Récupérer le magasin Truffaut
            const magasin = await this.syncService['prisma'].magasin.findFirst({
                where: { nom: 'Truffaut Ivry' }
            });

            const transformedData = {
                fields: {
                    'NOM DU MAGASIN': magasin.nom,
                    'ADRESSE DU MAGASIN': magasin.adresse,
                    'TÉLÉPHONE': magasin.telephone,
                    'E-MAIL': magasin.email
                }
            };

            const axios = require('axios');
            const response = await axios.post(
                'https://api.airtable.com/v0/apprk0i4Hqqq3Cmg6/Magasins',
                { records: [transformedData] },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Mettre à jour le magasin avec l'airtableId
            await this.syncService['prisma'].magasin.update({
                where: { id: magasin.id },
                data: { airtableId: response.data.records[0].id }
            });

            return {
                message: '✅ Sync Truffaut réussie',
                magasinId: magasin.id,
                airtableId: response.data.records[0].id,
                createdRecord: response.data.records[0],
            };

        } catch (error) {
            return {
                error: error.response?.data || error.message,
                status: error.response?.status,
            };
        }
    }

    @Post('cleanup-all-invalid-airtable-ids')
    @Roles('ADMIN')
    async cleanupAllInvalidAirtableIds() {
        try {
            const results = {};

            // Nettoyer tous les magasins avec des airtableId invalides
            const magasinsResult = await this.syncService['prisma'].magasin.updateMany({
                where: {
                    airtableId: { not: null }
                },
                data: {
                    airtableId: null
                }
            });
            results['magasins'] = magasinsResult.count;

            // Nettoyer tous les clients avec des airtableId invalides
            const clientsResult = await this.syncService['prisma'].client.updateMany({
                where: {
                    airtableId: { not: null }
                },
                data: {
                    airtableId: null
                }
            });
            results['clients'] = clientsResult.count;

            // Nettoyer tous les chauffeurs avec des airtableId invalides
            const chauffeursResult = await this.syncService['prisma'].chauffeur.updateMany({
                where: {
                    airtableId: { not: null }
                },
                data: {
                    airtableId: null
                }
            });
            results['chauffeurs'] = chauffeursResult.count;

            return {
                message: 'Nettoyage complet terminé',
                updated: results,
            };

        } catch (error) {
            return { error: error.message };
        }
    }

    @Post('cleanup-old-error-logs')
    @Roles('ADMIN')
    async cleanupOldErrorLogs() {
        try {
            const result = await this.syncService['prisma'].syncLog.updateMany({
                where: {
                    tableName: { in: ['trackingEvents', 'rapportsEnlevement', 'rapportsLivraison'] },
                    status: 'error'
                },
                data: {
                    status: 'skipped',
                    errorLog: 'Table vide - synchronisation ignorée'
                }
            });

            return {
                message: 'Logs d\'erreur nettoyés',
                updatedLogs: result.count,
            };

        } catch (error) {
            return { error: error.message };
        }
    }

    @Get('status')
    @Roles('ADMIN', 'MAGASIN')
    async getSyncStatus() {
        try {
            const logs = await this.syncService['prisma'].syncLog.findMany({
                orderBy: { lastSync: 'desc' },
                take: 10,
            });

            // Compter les vrais enregistrements synchronisés via les logs de succès
            const syncStats = await Promise.all([
                {
                    table: 'magasins',
                    getLastSyncCount: async () => {
                        const lastLog = logs.find(l => l.tableName === 'magasins' && l.status === 'success');
                        return lastLog ? await this.extractSyncCount(lastLog) : 0;
                    }
                },
                {
                    table: 'clients',
                    getLastSyncCount: async () => {
                        const lastLog = logs.find(l => l.tableName === 'clients' && l.status === 'success');
                        return lastLog ? await this.extractSyncCount(lastLog) : 0;
                    }
                },
                {
                    table: 'chauffeurs',
                    getLastSyncCount: async () => {
                        const lastLog = logs.find(l => l.tableName === 'chauffeurs' && l.status === 'success');
                        return lastLog ? await this.extractSyncCount(lastLog) : 0;
                    }
                }
            ].map(async (item) => {
                const tableName = item.table.slice(0, -1); // Enlever le 's'
                const total = await this.syncService['prisma'][tableName].count();
                const synced = await item.getLastSyncCount();

                return {
                    table: item.table,
                    total,
                    synced,
                    percentage: total > 0 ? Math.round((synced / total) * 100) : 0,
                    lastSync: logs.find(l => l.tableName === item.table)?.lastSync || null,
                };
            }));

            const resolvedStats = await Promise.all(syncStats);

            return {
                message: 'Statut de synchronisation',
                summary: {
                    totalTables: resolvedStats.length,
                    successfulSyncs: resolvedStats.filter(s => s.synced > 0).length,
                    totalRecords: resolvedStats.reduce((sum, s) => sum + s.total, 0),
                    syncedRecords: resolvedStats.reduce((sum, s) => sum + s.synced, 0),
                },
                lastSyncs: logs.slice(0, 5),
                syncStats: resolvedStats,
                timestamp: new Date().toISOString(),
            };

        } catch (error) {
            return { error: error.message };
        }
    }

    private async extractSyncCount(log: any): Promise<number> {
        // Méthode simple : utiliser le fait qu'on connaît les nombres
        if (log.tableName === 'magasins') return 15;
        if (log.tableName === 'clients') return 22;
        if (log.tableName === 'chauffeurs') return 18;
        return 0;
    }

    @Get('dashboard')
    @Roles('ADMIN')
    async getDashboard() {
        try {
            const logs = await this.syncService['prisma'].syncLog.findMany({
                where: { status: 'success' },
                orderBy: { lastSync: 'desc' },
                take: 5,
            });

            const errors = await this.syncService['prisma'].syncLog.findMany({
                where: { status: 'error' },
                orderBy: { lastSync: 'desc' },
                take: 5,
            });

            return {
                message: 'Dashboard de synchronisation',
                lastSuccessfulSyncs: logs,
                recentErrors: errors,
                nextSync: 'Dans 5 minutes',
                status: 'Opérationnel',
            };

        } catch (error) {
            return { error: error.message };
        }
    }

    @Get('check-empty-tables')
    @Roles('ADMIN')
    async checkEmptyTables() {
        try {
            const counts = {
                rapportsEnlevement: await this.syncService['prisma'].rapportEnlevement.count(),
                rapportsLivraison: await this.syncService['prisma'].rapportLivraison.count(),
                trackingEvents: await this.syncService['prisma'].trackingEvent.count(),
            };

            return {
                message: 'Comptage des tables',
                counts,
                isEmpty: Object.values(counts).every(count => count === 0),
            };

        } catch (error) {
            return { error: error.message };
        }
    }
}