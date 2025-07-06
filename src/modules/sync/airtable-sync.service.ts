import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';

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
        frequency: string;
        critical: boolean;
        airtableTableId: string;
        fieldMapping: Record<string, string>;
    };
}

interface AirtableRecord {
    id?: string;
    fields: Record<string, any>;
    createdTime?: string;
    [key: string]: any; // Allow extra properties like originalId
}

@Injectable()
export class AirtableSyncService {
    private readonly logger = new Logger(AirtableSyncService.name);
    private readonly airtableApiUrl: string;
    private readonly airtableToken: string;
    private readonly baseId: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        this.airtableToken = this.configService.get<string>('AIRTABLE_TOKEN');
        this.baseId = this.configService.get<string>('AIRTABLE_BASE_ID');
        this.airtableApiUrl = `https://api.airtable.com/v0/${this.baseId}`;
    }

    private readonly syncConfig: SyncConfig = {
        commandes: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/2 * * * *',
            critical: true,
            airtableTableId: 'Commandes',
            fieldMapping: {
                numeroCommande: 'NUMERO DE COMMANDE',
                dateCommande: 'DATE DE LA COMMANDE',
                dateLivraison: 'DATE DE LA LIVRAISON',
                statutCommande: 'STATUT DE LA COMMANDE',
                statutLivraison: 'STATUT DE LA LIVRAISON (ENCART MYTRUCK)',
                tarifHT: 'TARIF HT',
                creneauLivraison: 'CRENEAU DE LIVRAISON',
                categorieVehicule: 'CATEGORIE DE VEHICULE',
                optionEquipier: 'OPTION EQUIPIER DE MANUTENTION',
                reserveTransport: 'RESERVE TRANSPORT',
                prenomVendeur: 'PRENOM DU VENDEUR/INTERLOCUTEUR',
                remarques: 'AUTRES REMARQUES',
                'client.nom': 'NOM DU CLIENT',
                'client.prenom': 'PRENOM DU CLIENT',
                'client.telephone': 'TELEPHONE DU CLIENT',
                'client.telephoneSecondaire': 'TELEPHONE DU CLIENT 2',
                'client.adresseLigne1': 'ADRESSE DE LIVRAISON',
                'client.typeAdresse': 'TYPE D\'ADRESSE',
                'client.batiment': 'BÂTIMENT',
                'client.etage': 'ETAGE',
                'client.interphone': 'INTERPHONE/CODE',
                'client.ascenseur': 'ASCENSEUR',
                'magasin.nom': 'NOM DU MAGASIN',
                'articles.nombre': 'NOMBRE TOTAL D\'ARTICLES',
                'articles.details': 'DETAILS SUR LES ARTICLES',
            },
        },
        clients: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/5 * * * *',
            critical: true,
            airtableTableId: 'Clients',
            fieldMapping: {
                nom: 'NOM DU CLIENT',
                prenom: 'PRENOM DU CLIENT',
                telephone: 'TELEPHONE DU CLIENT',
                telephoneSecondaire: 'TELEPHONE DU CLIENT 2',
                adresseLigne1: 'ADRESSE DE LIVRAISON',
                // ascenseur: 'ASCENSEUR',
                batiment: 'BÂTIMENT',
                etage: 'ETAGE',
                interphone: 'INTERPHONE/CODE',
            },
        },
        chauffeurs: {
            direction: SyncDirection.BIDIRECTIONAL,
            priority: 'DB',
            frequency: '*/10 * * * *',
            critical: false,
            airtableTableId: 'Personnel My Truck',
            fieldMapping: {
                nom: 'NOM',
                telephone: 'TELEPHONE',
                email: 'E-MAIL',
                role: 'RÔLE',
                status: 'STATUT',
                notes: 'NOTES',
                latitude: 'LATITUDE',
                longitude: 'LONGITUDE',
            },
        },
        magasins: {
            direction: SyncDirection.BIDIRECTIONAL,
            priority: 'DB',
            frequency: '*/15 * * * *',
            critical: false,
            airtableTableId: 'Magasins',
            fieldMapping: {
                nom: 'NOM DU MAGASIN',
                adresse: 'ADRESSE DU MAGASIN',
                telephone: 'TÉLÉPHONE',
                email: 'E-MAIL',
            },
        },
        users: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/15 * * * *',
            critical: false,
            airtableTableId: 'Users',
            fieldMapping: {
                nom: 'NOM',
                email: 'E-MAIL',
                role: 'RÔLE',
                'magasin.nom': 'ENTREPRISE/MAGASIN',
            },
        },
        rapportsEnlevement: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/5 * * * *',
            critical: false,
            airtableTableId: 'Rapports à l\'enlèvement',
            fieldMapping: {
                'chauffeur.nom': 'NOM DU CHAUFFEUR',
                'commande.numeroCommande': 'NUMERO DE COMMANDE',
                commentaire: 'MESSAGE',
                dateRapport: 'DATE / HEURE',
                'commande.magasin.nom': 'MAGASIN',
            },
        },
        rapportsLivraison: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/5 * * * *',
            critical: false,
            airtableTableId: 'Rapports à la livraison',
            fieldMapping: {
                'chauffeur.nom': 'NOM DU CHAUFFEUR',
                'commande.numeroCommande': 'NUMERO DE COMMANDE',
                commentaire: 'MESSAGE',
                dateRapport: 'DATE / HEURE',
                'commande.magasin.nom': 'MAGASIN',
            },
        },
        trackingEvents: {
            direction: SyncDirection.READ_ONLY,
            priority: 'DB',
            frequency: '*/1 * * * *',
            critical: false,
            airtableTableId: 'Historique',
            fieldMapping: {
                eventType: 'HISTORIQUE DES LIVRAISONS',
                timestamp: 'DATE / HEURE',
                'commande.numeroCommande': 'NUMERO DE COMMANDE',
                'commande.statutLivraison': 'STATUT DE LA LIVRAISON (ENCART MYTRUCK)',
            },
        },
        factures: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/10 * * * *',
            critical: true,
            airtableTableId: 'Factures',
            fieldMapping: {
                numeroFacture: 'NUMÉRO DE FACTURE',
                dateFacture: 'DATE DE FACTURATION',
                statut: 'STATUT',
                'magasin.nom': 'MAGASIN',
                'commande.numeroCommande': 'COMMANDE',
            },
        },
        devis: {
            direction: SyncDirection.DB_TO_AIRTABLE,
            priority: 'DB',
            frequency: '*/10 * * * *',
            critical: false,
            airtableTableId: 'Devis',
            fieldMapping: {
                numeroDevis: 'NUMÉRO DE DEVIS',
                dateDevis: 'DATE DE DEVIS',
                statut: 'STATUT',
                'magasin.nom': 'MAGASIN',
                'commande.numeroCommande': 'COMMANDE',
            },
        },
    };

    // ========================
    // SYNCHRONISATION PRINCIPALE
    // ========================

    private async getTableCount(tableName: string): Promise<number> {
        try {
            switch (tableName) {
                case 'commandes':
                    return this.prisma.commande.count();
                case 'clients':
                    return this.prisma.client.count();
                case 'chauffeurs':
                    return this.prisma.chauffeur.count();
                case 'magasins':
                    return this.prisma.magasin.count();
                case 'users':
                    return this.prisma.user.count();
                case 'rapportsEnlevement':
                    return this.prisma.rapportEnlevement.count();
                case 'rapportsLivraison':
                    return this.prisma.rapportLivraison.count();
                case 'trackingEvents':
                    return this.prisma.trackingEvent.count();
                case 'factures':
                    return this.prisma.facture.count();
                case 'devis':
                    return this.prisma.devis.count();
                default:
                    return 0;
            }
        } catch (error) {
            this.logger.error(`⚠️ Erreur comptage ${tableName}:`, error.message);
            return 0;
        }
    }

    async syncToAirtable(tableName: string, force = false): Promise<void> {
        const config = this.syncConfig[tableName];
        if (!config) {
            this.logger.warn(`❌ Configuration de sync non trouvée pour: ${tableName}`);
            return;
        }

        try {
            this.logger.debug(`🔄 Début sync ${tableName} vers Airtable...`);

            // Skip si la table est vide et pas forcée
            if (!force) {
                const tableCount = await this.getTableCount(tableName);
                if (tableCount === 0) {
                    this.logger.debug(`📊 Table ${tableName} vide, synchronisation ignorée`);
                    return;
                }
            }

            // Récupérer les enregistrements modifiés
            const lastSync = await this.getLastSyncTimestamp(tableName);
            const modifiedRecords = await this.getModifiedRecords(tableName, lastSync, force);

            if (modifiedRecords.length === 0 && !force) {
                this.logger.debug(`📊 Aucune modification pour ${tableName}`);
                return;
            }

            // Convertir et envoyer vers Airtable
            const airtableRecords = this.transformToAirtable(modifiedRecords, config);
            const results = await this.batchUpdateAirtable(config.airtableTableId, airtableRecords);

            // Mettre à jour le timestamp de sync
            await this.updateSyncTimestamp(tableName, 'success');

            this.logger.log(`✅ Sync ${tableName}: ${results.length} enregistrements synchronisés`);

        } catch (error) {
            this.logger.error(`❌ Erreur sync ${tableName}:`, error.message);
            await this.updateSyncTimestamp(tableName, 'error', error.message);

            if (config.critical) {
                await this.sendCriticalSyncAlert(tableName, error);
            }
        }
    }


    async bidirectionalSync(tableName: string): Promise<void> {
        const config = this.syncConfig[tableName];
        if (config.direction !== SyncDirection.BIDIRECTIONAL) return;

        try {
            this.logger.debug(`🔄 Sync bidirectionnelle ${tableName}...`);

            // 1. Sync DB → Airtable
            await this.syncToAirtable(tableName);

            // 2. Récupérer modifications Airtable
            const airtableChanges = await this.getAirtableChanges(config);

            if (airtableChanges.length === 0) {
                this.logger.debug(`📊 Aucune modification Airtable pour ${tableName}`);
                return;
            }

            // 3. Résolution des conflits
            const resolvedChanges = await this.resolveConflicts(tableName, airtableChanges, config);

            // 4. Appliquer les changements acceptés
            const appliedChanges = await this.applyChangesToDB(tableName, resolvedChanges, config);

            this.logger.log(`🔄 Sync bidirectionnelle ${tableName}: ${appliedChanges} changements appliqués`);

        } catch (error) {
            this.logger.error(`❌ Erreur sync bidirectionnelle ${tableName}:`, error.message);
        }
    }

    // ========================
    // TRANSFORMATION DES DONNÉES
    // ========================

    private transformToAirtable(records: any[], config: SyncConfig[string]): AirtableRecord[] {
        return records.map(record => {
            const fields: Record<string, any> = {};

            for (const [dbField, airtableField] of Object.entries(config.fieldMapping)) {
                const value = this.getNestedValue(record, dbField);
                if (value !== null && value !== undefined) {
                    fields[airtableField] = this.formatValueForAirtable(value);
                }
            }

            if (Object.keys(fields).length === 0) {
                return null;
            }

            const airtableRecord: AirtableRecord = {
                fields,
                originalId: record.id // pr tracking
            };

            // Réactiver les mises à jour une fois les airtableId corrects
            if (record.airtableId && record.airtableId.startsWith('rec')) {
                airtableRecord.id = record.airtableId;
                delete airtableRecord.originalId; // Pas besoin pour les updates
            }

            return airtableRecord;
        }).filter(record => record !== null);
    }

    private transformFromAirtable(airtableRecords: any[], config: SyncConfig[string]): any[] {
        return airtableRecords.map(record => {
            const dbRecord: any = {};

            for (const [dbField, airtableField] of Object.entries(config.fieldMapping)) {
                const value = record.fields[airtableField];
                if (value !== null && value !== undefined) {
                    this.setNestedValue(dbRecord, dbField, this.formatValueFromAirtable(value));
                }
            }

            // Ajouter l'ID Airtable pour référence
            dbRecord.airtableId = record.id;

            return dbRecord;
        });
    }

    // ========================
    // API AIRTABLE
    // ========================

    private async batchUpdateAirtable(tableId: string, records: AirtableRecord[]): Promise<any[]> {
        const batchSize = 10;
        const results: any[] = [];

        // Filtrer les enregistrements invalides
        const validRecords = records.filter(record =>
            record && record.fields && Object.keys(record.fields).length > 0
        );

        if (validRecords.length === 0) {
            this.logger.debug(`📊 Aucun enregistrement valide à synchroniser pour ${tableId}`);
            return [];
        }

        // Séparer créations et mises à jour
        const recordsToCreate = validRecords.filter(r => !r.id);
        const recordsToUpdate = validRecords.filter(r => r.id);

        try {
            // CRÉATIONS
            if (recordsToCreate.length > 0) {
                this.logger.debug(`📝 Création de ${recordsToCreate.length} enregistrements dans ${tableId}`);

                for (let i = 0; i < recordsToCreate.length; i += batchSize) {
                    const batch = recordsToCreate.slice(i, i + batchSize);

                    const response = await axios.post(
                        `${this.airtableApiUrl}/${tableId}`,
                        { records: batch },
                        {
                            headers: {
                                'Authorization': `Bearer ${this.airtableToken}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    results.push(...response.data.records);
                    this.logger.debug(`✅ Créé ${batch.length} enregistrements dans ${tableId}`);

                    // Mettre à jour les airtableId dans la DB
                    await this.updateAirtableIds(tableId, batch, response.data.records);

                    if (i + batchSize < recordsToCreate.length) {
                        await this.sleep(200);
                    }
                }
            }

            // MISES À JOUR
            if (recordsToUpdate.length > 0) {
                this.logger.debug(`✏️ Mise à jour de ${recordsToUpdate.length} enregistrements dans ${tableId}`);

                for (let i = 0; i < recordsToUpdate.length; i += batchSize) {
                    const batch = recordsToUpdate.slice(i, i + batchSize);

                    const response = await axios.patch(
                        `${this.airtableApiUrl}/${tableId}`,
                        { records: batch },
                        {
                            headers: {
                                'Authorization': `Bearer ${this.airtableToken}`,
                                'Content-Type': 'application/json',
                            },
                        }
                    );

                    results.push(...response.data.records);
                    this.logger.debug(`✅ Mis à jour ${batch.length} enregistrements dans ${tableId}`);

                    if (i + batchSize < recordsToUpdate.length) {
                        await this.sleep(200);
                    }
                }
            }

            return results;

        } catch (error) {
            this.logger.error(`❌ Erreur batch Airtable ${tableId}:`, error.response?.data || error.message);
            throw error;
        }
    }

    // Mettre à jour les airtableId
    private async updateAirtableIds(tableId: string, originalRecords: any[], airtableRecords: any[]): Promise<void> {
        if (!originalRecords || !airtableRecords || originalRecords.length !== airtableRecords.length) {
            this.logger.warn(`⚠️ Mismatch entre records originaux et Airtable pour ${tableId}`);
            return;
        }

        try {
            for (let i = 0; i < originalRecords.length; i++) {
                const originalRecord = originalRecords[i];
                const airtableRecord = airtableRecords[i];

                if (originalRecord && airtableRecord && airtableRecord.id) {
                    await this.updateRecordAirtableId(tableId, originalRecord, airtableRecord.id);
                }
            }

            this.logger.debug(`✅ Mis à jour ${airtableRecords.length} airtableId pour ${tableId}`);

        } catch (error) {
            this.logger.error(`❌ Erreur mise à jour airtableId pour ${tableId}:`, error.message);
        }
    }

    private async updateRecordAirtableId(tableId: string, originalRecord: any, airtableId: string): Promise<void> {
        const recordId = originalRecord.fields ? originalRecord.originalId : originalRecord.id;

        if (!recordId) {
            this.logger.warn(`⚠️ Impossible de trouver l'ID pour mettre à jour l'airtableId`);
            return;
        }

        switch (tableId) {
            case 'Magasins':
                await this.prisma.magasin.update({
                    where: { id: recordId },
                    data: { airtableId }
                });
                break;

            case 'Clients':
                await this.prisma.client.update({
                    where: { id: recordId },
                    data: { airtableId }
                });
                break;

            case 'Personnel My Truck':
                await this.prisma.chauffeur.update({
                    where: { id: recordId },
                    data: { airtableId }
                });
                break;

            default:
                this.logger.warn(`⚠️ Table non configurée pour updateAirtableId: ${tableId}`);
        }
    }

    private async getAirtableChanges(config: SyncConfig[string]): Promise<any[]> {
        try {
            const lastSync = await this.getLastSyncTimestamp(`${config.airtableTableId}_from_airtable`);

            const response = await axios.get(`${this.airtableApiUrl}/${config.airtableTableId}`, {
                headers: {
                    'Authorization': `Bearer ${this.airtableToken}`,
                },
                params: {
                    filterByFormula: `IS_AFTER(CREATED_TIME(), '${lastSync.toISOString()}')`,
                    sort: [{ field: 'CREATED_TIME', direction: 'asc' }],
                },
            });

            return response.data.records || [];

        } catch (error) {
            this.logger.error(`❌ Erreur récupération Airtable:`, error.response?.data || error.message);
            return [];
        }
    }

    // ========================
    // RÉSOLUTION DE CONFLITS
    // ========================

    private async resolveConflicts(tableName: string, airtableChanges: any[], config: SyncConfig[string]): Promise<any[]> {
        const resolvedChanges: any[] = [];

        for (const airtableRecord of airtableChanges) {
            const transformedRecord = this.transformFromAirtable([airtableRecord], config)[0];

            // Vérifier s'il y a conflit avec la DB
            const dbRecord = await this.findDBRecordByAirtableId(tableName, airtableRecord.id);

            if (!dbRecord) {
                // Nouveau record, pas de conflit
                resolvedChanges.push(transformedRecord);
                continue;
            }

            // Résolution selon la priorité configurée
            const shouldAccept = await this.shouldAcceptAirtableChange(
                dbRecord,
                airtableRecord,
                config
            );

            if (shouldAccept) {
                resolvedChanges.push({ ...transformedRecord, id: dbRecord.id });
                this.logger.debug(`✅ Conflit résolu en faveur d'Airtable: ${airtableRecord.id}`);
            } else {
                this.logger.debug(`❌ Changement Airtable rejeté (priorité DB): ${airtableRecord.id}`);
            }
        }

        return resolvedChanges;
    }

    private async shouldAcceptAirtableChange(dbRecord: any, airtableRecord: any, config: SyncConfig[string]): Promise<boolean> {
        switch (config.priority) {
            case 'DB':
                // Accepter seulement si Airtable plus récent
                const airtableModified = new Date(airtableRecord.createdTime);
                const dbModified = new Date(dbRecord.updatedAt || dbRecord.createdAt);
                return airtableModified > dbModified;

            case 'AIRTABLE':
                // Toujours accepter les changements Airtable
                return true;

            case 'TIMESTAMP':
                // Accepter le plus récent
                const airtableTime = new Date(airtableRecord.createdTime);
                const dbTime = new Date(dbRecord.updatedAt || dbRecord.createdAt);
                return airtableTime > dbTime;

            default:
                return false;
        }
    }

    // ========================
    // UTILITAIRES
    // ========================

    private async getModifiedRecords(tableName: string, since: Date, force = false): Promise<any[]> {

        switch (tableName) {
            case 'commandes':
                const commandesWhere = force ? {} : { updatedAt: { gt: since } };
                return this.prisma.commande.findMany({
                    where: commandesWhere,
                    include: {
                        client: true,
                        magasin: { select: { nom: true } },
                        articles: true,
                        chauffeurs: {
                            include: {
                                chauffeur: { select: { nom: true, prenom: true } }
                            }
                        },
                    },
                });

            case 'clients':
                const clientsWhere = force ? {} : { updatedAt: { gt: since } };
                return this.prisma.client.findMany({ where: clientsWhere });

            case 'chauffeurs':
                const chauffeursWhere = force ? {} : { updatedAt: { gt: since } };
                return this.prisma.chauffeur.findMany({ where: chauffeursWhere });

            case 'magasins':
                const magasinsWhere = force ? {} : { updatedAt: { gt: since } };
                return this.prisma.magasin.findMany({ where: magasinsWhere });

            case 'users':
                const usersWhere = force ? {} : { updatedAt: { gt: since } };
                return this.prisma.user.findMany({
                    where: usersWhere,
                    include: {
                        magasin: { select: { nom: true } },
                    },
                });

            case 'rapportsEnlevement':
                const rapportsEnlevementWhere = force ? {} : { createdAt: { gt: since } };
                return this.prisma.rapportEnlevement.findMany({
                    where: rapportsEnlevementWhere,
                    include: {
                        chauffeur: { select: { nom: true, prenom: true } },
                        commande: {
                            select: {
                                numeroCommande: true,
                                magasin: { select: { nom: true } }
                            }
                        },
                    },
                });

            case 'rapportsLivraison':
                const rapportsLivraisonWhere = force ? {} : { createdAt: { gt: since } };
                return this.prisma.rapportLivraison.findMany({
                    where: rapportsLivraisonWhere,
                    include: {
                        chauffeur: { select: { nom: true, prenom: true } },
                        commande: {
                            select: {
                                numeroCommande: true,
                                magasin: { select: { nom: true } }
                            }
                        },
                    },
                });

            case 'trackingEvents':
                const trackingEventsWhere = force ? {} : { timestamp: { gt: since } };
                return this.prisma.trackingEvent.findMany({
                    where: trackingEventsWhere,
                    include: {
                        commande: {
                            select: {
                                numeroCommande: true,
                                statutLivraison: true,
                            }
                        },
                    },
                });

            case 'factures':
                const facturesWhere = force ? {} : { updatedAt: { gt: since } };
                return this.prisma.facture.findMany({
                    where: facturesWhere,
                    include: {
                        magasin: { select: { nom: true } },
                        commande: { select: { numeroCommande: true } },
                    },
                });

            case 'devis':
                const devisWhere = force ? {} : { updatedAt: { gt: since } };
                return this.prisma.devis.findMany({
                    where: devisWhere,
                    include: {
                        magasin: { select: { nom: true } },
                        commande: { select: { numeroCommande: true } },
                    },
                });

            default:
                this.logger.warn(`⚠️ Table non configurée: ${tableName}`);
                return [];
        }
    }

    private async applyChangesToDB(tableName: string, changes: any[], config: SyncConfig[string]): Promise<number> {
        let appliedCount = 0;

        for (const change of changes) {
            try {
                await this.upsertDBRecord(tableName, change);
                appliedCount++;
            } catch (error) {
                this.logger.error(`❌ Erreur application changement DB:`, error.message);
            }
        }

        return appliedCount;
    }

    private async upsertDBRecord(tableName: string, record: any): Promise<void> {
        const { id, airtableId, ...data } = record;

        switch (tableName) {
            case 'chauffeurs':
                await this.prisma.chauffeur.upsert({
                    where: { airtableId: airtableId || 'non-existent' },
                    update: data,
                    create: { ...data, airtableId },
                });
                break;

            case 'magasins':
                await this.prisma.magasin.upsert({
                    where: { airtableId: airtableId || 'non-existent' },
                    update: data,
                    create: { ...data, airtableId },
                });
                break;

            case 'users':
                await this.prisma.user.upsert({
                    where: { airtableId: airtableId || 'non-existent' },
                    update: data,
                    create: { ...data, airtableId },
                });
                break;

            default:
                this.logger.warn(`⚠️ Upsert non configuré pour: ${tableName}`);
        }
    }

    // ========================
    // TÂCHES PLANIFIÉES
    // ========================

    @Cron('*/5 * * * *') // Toutes les 5 minutes
    async syncCriticalTables(): Promise<void> {
        const criticalTables = Object.entries(this.syncConfig)
            .filter(([_, config]) => config.critical && config.direction !== SyncDirection.READ_ONLY)
            .map(([tableName]) => tableName);

        this.logger.log(`🔄 Synchronisation automatique: ${criticalTables.join(', ')}`);

        for (const tableName of criticalTables) {
            await this.syncToAirtable(tableName);
        }
    }

    @Cron('*/15 * * * *') // Toutes les 15 minutes
    async syncBidirectionalTables(): Promise<void> {
        const bidirectionalTables = Object.entries(this.syncConfig)
            .filter(([_, config]) => config.direction === SyncDirection.BIDIRECTIONAL)
            .map(([tableName]) => tableName);

        this.logger.log(`🔄 Synchronisation bidirectionnelle: ${bidirectionalTables.join(', ')}`);

        for (const tableName of bidirectionalTables) {
            await this.bidirectionalSync(tableName);
        }
    }

    // ========================
    // MÉTHODES UTILITAIRES PRIVÉES
    // ========================

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop()!;
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    private formatValueForAirtable(value: any): any {
        if (value instanceof Date) {
            return value.toISOString();
        }
        if (typeof value === 'boolean') {
            return value ? 'Oui' : 'Non'; // Conversion pr Airtable
        }
        if (typeof value === 'number' && !isFinite(value)) {
            return null;
        }
        if (Array.isArray(value)) {
            return value.join(', '); // Conversion Arrays en string
        }
        return value;
    }

    private formatValueFromAirtable(value: any): any {
        if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
            return new Date(value);
        }
        return value;
    }

    private async findDBRecordByAirtableId(tableName: string, airtableId: string): Promise<any> {
        switch (tableName) {
            case 'chauffeurs':
                return this.prisma.chauffeur.findUnique({ where: { airtableId } });
            case 'magasins':
                return this.prisma.magasin.findUnique({ where: { airtableId } });
            default:
                return null;
        }
    }

    private async getLastSyncTimestamp(tableName: string): Promise<Date> {
        const syncRecord = await this.prisma.syncLog.findUnique({
            where: { tableName },
        });
        return syncRecord?.lastSync || new Date(0);
    }

    private async updateSyncTimestamp(tableName: string, status: string, errorLog?: string): Promise<void> {
        await this.prisma.syncLog.upsert({
            where: { tableName },
            create: {
                tableName,
                lastSync: new Date(),
                status,
                direction: 'db_to_airtable',
                errorLog,
            },
            update: {
                lastSync: new Date(),
                status,
                errorLog,
            },
        });
    }

    private async sendCriticalSyncAlert(tableName: string, error: any): Promise<void> {
        // Implémenter notification (email, Slack, etc.)
        this.logger.error(`🚨 ALERTE CRITIQUE: Échec sync ${tableName}`, {
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public getConfig(tableName: string) {
        return this.syncConfig[tableName];
    }

    public async testTransform(tableName: string, records: any[]) {
        const config = this.syncConfig[tableName];
        return this.transformToAirtable(records, config);
    }

    public async testAirtableConnection() {
        return {
            baseUrl: this.airtableApiUrl,
            hasToken: !!this.airtableToken,
            hasBaseId: !!this.baseId,
        };
    }
}