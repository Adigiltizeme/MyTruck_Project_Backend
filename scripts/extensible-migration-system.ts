import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface TableConfig {
    airtableName: string;
    postgresTable: string;
    prismaModel: string;
    priority: number;
    dependencies: string[];
    isActive: boolean;
    mapping: FieldMapping[];
    customProcessor?: string;
    airtableFile?: string;
}

interface FieldMapping {
    airtableField: string;
    postgresField: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'relation' | 'json';
    required: boolean;
    defaultValue?: any;
    processor?: string;
}

interface MigrationResult {
    table: string;
    processed: number;
    success: number;
    errors: number;
    skipped: number;
    issues: string[];
}

export class ExtensibleMigrationSystem {

    // Configuration des tables avec mapping détaillé
    private tableConfigs: Record<string, TableConfig> = {
        // Tables principales (déjà migrées)
        'Users': {
            airtableName: 'Users',
            postgresTable: 'users',
            prismaModel: 'user',
            priority: 1,
            dependencies: [],
            isActive: true,
            mapping: [
                { airtableField: 'E-MAIL', postgresField: 'email', type: 'string', required: true },
                { airtableField: 'NOM', postgresField: 'nom', type: 'string', required: false },
                { airtableField: 'PRENOM', postgresField: 'prenom', type: 'string', required: false },
                { airtableField: 'RÔLE', postgresField: 'role', type: 'string', required: false, processor: 'mapUserRole' },
                { airtableField: 'TELEPHONE', postgresField: 'telephone', type: 'string', required: false }
            ]
        },

        'Magasins': {
            airtableName: 'Magasins',
            postgresTable: 'magasins',
            prismaModel: 'magasin',
            priority: 2,
            dependencies: [],
            isActive: true,
            mapping: [
                { airtableField: 'NOM DU MAGASIN', postgresField: 'nom', type: 'string', required: true },
                { airtableField: 'ADRESSE DU MAGASIN', postgresField: 'adresse', type: 'string', required: false },
                { airtableField: 'TELEPHONE', postgresField: 'telephone', type: 'string', required: false },
                { airtableField: 'EMAIL', postgresField: 'email', type: 'string', required: false }
            ]
        },

        'Clients': {
            airtableName: 'Clients',
            postgresTable: 'clients',
            prismaModel: 'client',
            priority: 3,
            dependencies: [],
            isActive: true,
            mapping: [
                { airtableField: 'NOM DU CLIENT', postgresField: 'nom', type: 'string', required: false },
                { airtableField: 'PRENOM DU CLIENT', postgresField: 'prenom', type: 'string', required: false },
                { airtableField: 'TELEPHONE DU CLIENT', postgresField: 'telephone', type: 'string', required: false },
                { airtableField: 'E-MAIL', postgresField: 'email', type: 'string', required: false }
            ]
        },

        'Personnel My Truck': {
            airtableName: 'Personnel My Truck',
            postgresTable: 'chauffeurs',
            prismaModel: 'chauffeur',
            priority: 4,
            dependencies: [],
            isActive: true,
            mapping: [
                { airtableField: 'NOM', postgresField: 'nom', type: 'string', required: true },
                { airtableField: 'PRENOM', postgresField: 'prenom', type: 'string', required: false },
                { airtableField: 'E-MAIL', postgresField: 'email', type: 'string', required: false },
                { airtableField: 'TELEPHONE', postgresField: 'telephone', type: 'string', required: false },
                { airtableField: 'RÔLE', postgresField: 'role', type: 'string', required: false, processor: 'filterChauffeurs' }
            ],
            customProcessor: 'processChauffeurs'
        },

        'Commandes': {
            airtableName: 'Commandes',
            postgresTable: 'commandes',
            prismaModel: 'commande',
            priority: 5,
            dependencies: ['Magasins', 'Clients'],
            isActive: true,
            mapping: [
                { airtableField: 'NUMERO DE COMMANDE', postgresField: 'numeroCommande', type: 'string', required: true },
                { airtableField: 'DATE DE LIVRAISON', postgresField: 'dateLivraison', type: 'date', required: true },
                { airtableField: 'Magasins', postgresField: 'magasinId', type: 'relation', required: true, processor: 'resolveMagasin' },
                { airtableField: 'Clients', postgresField: 'clientId', type: 'relation', required: true, processor: 'resolveClient' },
                { airtableField: 'STATUT DE LA COMMANDE', postgresField: 'statutCommande', type: 'string', required: false, processor: 'mapStatutCommande' },
                { airtableField: 'TARIF HT', postgresField: 'tarifHT', type: 'number', required: false, defaultValue: 0 }
            ]
        },

        // Tables supplémentaires à migrer
        'Renseignements prestations (livraisons)': {
            airtableName: 'Renseignements prestations (livraisons)',
            airtableFile: 'Renseignements_prestations__livraisons_.json',
            postgresTable: 'renseignements_prestations',
            prismaModel: 'renseignementPrestation',
            priority: 6,
            dependencies: ['Commandes'],
            isActive: true,
            mapping: [
                { airtableField: 'NOM COMPLET DU CLIENT', postgresField: 'nomCompletClient', type: 'string', required: false },
                { airtableField: 'NUMERO DE COMMANDE', postgresField: 'numeroCommande', type: 'string', required: false },
                { airtableField: 'DATE DE LIVRAISON MAJ', postgresField: 'dateLivraisonMaj', type: 'date', required: false }
            ],
            customProcessor: 'processRenseignements'
        },

        'Historique': {
            airtableName: 'Historique',
            airtableFile: 'Historique.json',
            postgresTable: 'historique',
            prismaModel: 'historique',
            priority: 7,
            dependencies: ['Commandes'],
            isActive: true,
            mapping: [
                { airtableField: 'HISTORIQUE DES LIVRAISONS', postgresField: 'historiqueLivraisons', type: 'string', required: false },
                { airtableField: 'Commandes', postgresField: 'commandeId', type: 'relation', required: false, processor: 'resolveCommande' }
            ],
            customProcessor: 'processHistorique'
        },

        'Rapports à l\'enlèvement': {
            airtableName: 'Rapports à l\'enlèvement',
            airtableFile: 'Rapports___l_enl_vement.json',
            postgresTable: 'rapports_enlevement',
            prismaModel: 'rapportEnlevement',
            priority: 8,
            dependencies: ['Commandes'],
            isActive: true,
            mapping: [
                { airtableField: 'NOM DU CHAUFFEUR', postgresField: 'nomChauffeur', type: 'string', required: false },
                { airtableField: 'MESSAGE', postgresField: 'message', type: 'string', required: false },
                { airtableField: 'NUMERO DE LA COMMANDE', postgresField: 'numeroCommande', type: 'string', required: false }
            ]
        },

        'Rapports à la livraison': {
            airtableName: 'Rapports à la livraison',
            airtableFile: 'Rapports___la_livraison.json',
            postgresTable: 'rapports_livraison',
            prismaModel: 'rapportLivraison',
            priority: 9,
            dependencies: ['Commandes'],
            isActive: true,
            mapping: [
                { airtableField: 'NOM DU CHAUFFEUR', postgresField: 'nomChauffeur', type: 'string', required: false },
                { airtableField: 'MESSAGE', postgresField: 'message', type: 'string', required: false },
                { airtableField: 'NUMERO DE LA COMMANDE', postgresField: 'numeroCommande', type: 'string', required: false }
            ]
        },

        'Cessions Inter magasins': {
            airtableName: 'Cessions Inter magasins',
            airtableFile: 'Cessions_Inter_magasins.json',
            postgresTable: 'cessions_inter_magasin',
            prismaModel: 'cessionInterMagasin',
            priority: 10,
            dependencies: ['Magasins'],
            isActive: true,
            mapping: [
                { airtableField: 'NUMERO DE CESSION', postgresField: 'numeroCession', type: 'string', required: false },
                { airtableField: 'MAGASIN DE CESSION', postgresField: 'magasinOrigineId', type: 'relation', required: false, processor: 'resolveMagasin' },
                { airtableField: 'ADRESSE DE LIVRAISON', postgresField: 'adresseLivraison', type: 'string', required: false }
            ]
        },

        'Devis': {
            airtableName: 'Devis',
            postgresTable: 'devis',
            prismaModel: 'devis',
            priority: 11,
            dependencies: ['Magasins', 'Commandes'],
            isActive: true,
            mapping: [
                { airtableField: 'NUMÉRO DE DEVIS', postgresField: 'numeroDevis', type: 'string', required: false },
                { airtableField: 'DATE DE DEVIS', postgresField: 'dateDevis', type: 'date', required: false },
                { airtableField: 'STATUT', postgresField: 'statut', type: 'string', required: false },
                { airtableField: 'MAGASIN', postgresField: 'magasinId', type: 'relation', required: false, processor: 'resolveMagasin' }
            ]
        },

        'Factures': {
            airtableName: 'Factures',
            postgresTable: 'factures',
            prismaModel: 'facture',
            priority: 12,
            dependencies: ['Magasins', 'Commandes'],
            isActive: true,
            mapping: [
                { airtableField: 'NUMÉRO DE FACTURE', postgresField: 'numeroFacture', type: 'string', required: false },
                { airtableField: 'DATE DE FACTURATION', postgresField: 'dateFacturation', type: 'date', required: false },
                { airtableField: 'STATUT', postgresField: 'statut', type: 'string', required: false },
                { airtableField: 'MAGASIN', postgresField: 'magasinId', type: 'relation', required: false, processor: 'resolveMagasin' }
            ]
        }
    };

    async executeExtensibleMigration(options: {
        tablesFilter?: string[];
        skipExisting?: boolean;
        dryRun?: boolean;
        autoDetect?: boolean;
    } = {}): Promise<void> {

        console.log('🚀 SYSTÈME DE MIGRATION EXTENSIBLE MY TRUCK TRANSPORT');
        console.log('='.repeat(80));
        console.log(`📅 Démarrage: ${new Date().toLocaleString()}`);

        try {
            // 1. Auto-détection des nouvelles tables si demandé
            if (options.autoDetect) {
                await this.autoDetectTables();
            }

            // 2. Validation et découverte des fichiers
            const availableTables = await this.discoverAvailableTables();

            // 3. Déterminer quelles tables migrer
            const tablesToMigrate = this.determineTablesToMigrate(availableTables, options.tablesFilter);

            // 4. Afficher le plan de migration
            await this.displayMigrationPlan(tablesToMigrate, options);

            // 5. Exécuter la migration
            if (!options.dryRun) {
                await this.executeMigrationPlan(tablesToMigrate, options);
            }

        } catch (error) {
            console.error('❌ Erreur migration extensible:', error);
            throw error;
        }
    }

    private async autoDetectTables(): Promise<void> {
        console.log('🔍 Auto-détection des tables...');

        const exportDir = './data/airtable-export/';
        const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));

        for (const file of files) {
            const tableName = file.replace('.json', '').replace(/_/g, ' ');

            if (!this.tableConfigs[tableName]) {
                console.log(`🆕 Nouvelle table détectée: ${tableName}`);

                // Analyser la structure pour créer une config de base
                const sampleData = this.analyzeSampleData(path.join(exportDir, file));

                this.tableConfigs[tableName] = this.generateBasicConfig(tableName, sampleData);
            }
        }
    }

    private analyzeSampleData(filePath: string): any {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (data.length > 0) {
                return data[0].fields || {};
            }
        } catch (error) {
            console.warn(`⚠️ Impossible d'analyser ${filePath}`);
        }
        return {};
    }

    private generateBasicConfig(tableName: string, sampleFields: any): TableConfig {
        const fields = Object.keys(sampleFields);

        return {
            airtableName: tableName,
            postgresTable: tableName.toLowerCase().replace(/\s+/g, '_'),
            prismaModel: this.toCamelCase(tableName),
            priority: 99, // Priorité basse pour nouvelles tables
            dependencies: [],
            isActive: false, // Inactif par défaut
            mapping: fields.map(field => ({
                airtableField: field,
                postgresField: this.toCamelCase(field),
                type: this.inferType(sampleFields[field]),
                required: false
            }))
        };
    }

    private async discoverAvailableTables(): Promise<string[]> {
        console.log('📁 Découverte des tables disponibles...');

        const exportDir = './data/airtable-export/';
        const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));

        const availableTables: string[] = [];

        for (const file of files) {
            const tableName = this.fileNameToTableName(file);

            if (this.tableConfigs[tableName]) {
                try {
                    const data = JSON.parse(fs.readFileSync(path.join(exportDir, file), 'utf8'));
                    console.log(`✅ ${tableName}: ${data.length} enregistrements`);
                    availableTables.push(tableName);
                } catch (error) {
                    console.warn(`⚠️ ${tableName}: fichier invalide`);
                }
            } else {
                console.log(`❓ ${tableName}: configuration manquante`);
            }
        }

        return availableTables;
    }

    private determineTablesToMigrate(availableTables: string[], filter?: string[]): string[] {
        let tables = availableTables.filter(table => this.tableConfigs[table].isActive);

        if (filter) {
            tables = tables.filter(table => filter.includes(table));
        }

        // Trier par priorité
        return tables.sort((a, b) => this.tableConfigs[a].priority - this.tableConfigs[b].priority);
    }

    private async displayMigrationPlan(tables: string[], options: any): Promise<void> {
        console.log('\n📋 PLAN DE MIGRATION:');
        console.log('-'.repeat(60));

        for (const table of tables) {
            const config = this.tableConfigs[table];
            const status = options.dryRun ? '🔄 DRY RUN' : '▶️ EXEC';

            console.log(`${status} ${config.priority}. ${table}`);
            console.log(`   📊 Table: ${config.postgresTable}`);
            console.log(`   🔗 Dépendances: ${config.dependencies.length > 0 ? config.dependencies.join(', ') : 'Aucune'}`);
            console.log(`   📝 Champs: ${config.mapping.length}`);

            if (config.customProcessor) {
                console.log(`   ⚙️ Processeur: ${config.customProcessor}`);
            }
        }

        console.log(`\n📊 Total: ${tables.length} tables à traiter`);

        if (options.dryRun) {
            console.log('🔄 MODE DRY RUN - Aucune modification ne sera effectuée');
        }
    }

    private async executeMigrationPlan(tables: string[], options: any): Promise<void> {
        console.log('\n🚀 EXÉCUTION DE LA MIGRATION...');
        console.log('='.repeat(60));

        const results: MigrationResult[] = [];

        for (const tableName of tables) {
            const result = await this.migrateTable(tableName, options);
            results.push(result);
        }

        // Rapport final
        await this.displayFinalResults(results);
    }

    private async migrateTable(tableName: string, options: any): Promise<MigrationResult> {
        console.log(`\n📦 Migration ${tableName}...`);
        console.log('-'.repeat(40));

        const config = this.tableConfigs[tableName];
        const result: MigrationResult = {
            table: tableName,
            processed: 0,
            success: 0,
            errors: 0,
            skipped: 0,
            issues: []
        };

        try {
            // Charger les données
            const filePath = `./data/airtable-export/${this.tableNameToFileName(tableName)}`;
            let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // Processeur custom si défini
            if (config.customProcessor) {
                data = await this.applyCustomProcessor(config.customProcessor, data);
            }

            result.processed = data.length;
            console.log(`📋 ${result.processed} enregistrements à traiter`);

            for (const record of data) {
                try {
                    const migrationResult = await this.migrateRecord(config, record, options);

                    switch (migrationResult.status) {
                        case 'success':
                            result.success++;
                            break;
                        case 'skipped':
                            result.skipped++;
                            break;
                        case 'error':
                            result.errors++;
                            result.issues.push(migrationResult.message || 'Erreur inconnue');
                            break;
                    }

                } catch (error) {
                    result.errors++;
                    result.issues.push(`Erreur ${record.id}: ${error.message}`);
                }
            }

            // Affichage du résultat
            const successRate = result.processed > 0 ? (result.success / result.processed) * 100 : 0;
            console.log(`📊 Résultats: ${result.success}✅ ${result.errors}❌ ${result.skipped}⚠️`);
            console.log(`🎯 Taux de réussite: ${successRate.toFixed(1)}%`);

        } catch (error) {
            console.error(`❌ Erreur migration ${tableName}:`, error);
            result.issues.push(`Erreur globale: ${error.message}`);
        }

        return result;
    }

    private async migrateRecord(config: TableConfig, record: any, options: any): Promise<{
        status: 'success' | 'skipped' | 'error';
        message?: string;
    }> {

        const airtableId = record.id;

        // Vérifier si déjà migré
        if (options.skipExisting) {
            const existing = await this.checkExisting(config.prismaModel, airtableId);
            if (existing) {
                return { status: 'skipped', message: 'Déjà migré' };
            }
        }

        // Construire les données à partir du mapping
        const data: any = { airtableId };

        for (const mapping of config.mapping) {
            const value = await this.processField(mapping, record.fields, record);

            if (value !== undefined) {
                data[mapping.postgresField] = value;
            } else if (mapping.required) {
                return { status: 'error', message: `Champ requis manquant: ${mapping.airtableField}` };
            } else if (mapping.defaultValue !== undefined) {
                data[mapping.postgresField] = mapping.defaultValue;
            }
        }

        // Créer l'enregistrement
        try {
            await this.createRecord(config.prismaModel, data);
            return { status: 'success' };
        } catch (error) {
            return { status: 'error', message: error.message };
        }
    }

    private async processField(mapping: FieldMapping, fields: any, record: any): Promise<any> {
        let value = fields[mapping.airtableField];

        if (value === undefined || value === null) {
            return undefined;
        }

        // Appliquer le processeur spécifique
        if (mapping.processor) {
            value = await this.applyProcessor(mapping.processor, value, fields, record);
        }

        // Conversion de type
        switch (mapping.type) {
            case 'string':
                return typeof value === 'string' ? value : String(value);
            case 'number':
                return parseFloat(value) || 0;
            case 'boolean':
                return Boolean(value);
            case 'date':
                return new Date(value);
            case 'json':
                return typeof value === 'object' ? value : JSON.parse(value);
            default:
                return value;
        }
    }

    // Processeurs spécialisés
    private async applyProcessor(processorName: string, value: any, fields: any, record: any): Promise<any> {
        switch (processorName) {
            case 'mapUserRole':
                return this.mapUserRole(value);
            case 'filterChauffeurs':
                return this.filterChauffeurs(value);
            case 'resolveMagasin':
                return await this.resolveMagasin(value);
            case 'resolveClient':
                return await this.resolveClient(value);
            case 'resolveCommande':
                return await this.resolveCommande(value);
            case 'mapStatutCommande':
                return this.mapStatutCommande(value);
            default:
                return value;
        }
    }

    private async applyCustomProcessor(processorName: string, data: any[]): Promise<any[]> {
        switch (processorName) {
            case 'processChauffeurs':
                return data.filter(person => {
                    const roles = person.fields['RÔLE'] || person.fields['ROLE'] || [];
                    return Array.isArray(roles) ? roles.includes('Chauffeur') :
                        typeof roles === 'string' ? roles.toLowerCase().includes('chauffeur') : false;
                });
            case 'processRenseignements':
                // Logique spécifique pour les renseignements
                return data.filter(r => r.fields['NUMERO DE COMMANDE']);
            case 'processHistorique':
                // Logique spécifique pour l'historique
                return data.filter(h => h.fields['HISTORIQUE DES LIVRAISONS']);
            default:
                return data;
        }
    }

    // Méthodes utilitaires
    private fileNameToTableName(fileName: string): string {
        // Mappings spéciaux pour les noms de fichiers avec caractères spéciaux
        const specialMappings = {
            'Rapports___la_livraison.json': 'Rapports à la livraison',
            'Rapports___l_enl_vement.json': 'Rapports à l\'enlèvement',
            'Renseignements_prestations__livraisons_.json': 'Renseignements prestations (livraisons)',
            'Cessions_Inter_magasins.json': 'Cessions Inter magasins',
            'Personnel_My_Truck.json': 'Personnel My Truck'
        };

        if (specialMappings[fileName]) {
            return specialMappings[fileName];
        }

        return fileName.replace('.json', '').replace(/_/g, ' ');
    }

    private tableNameToFileName(tableName: string): string {
        // Trouver le fichier correspondant dans la configuration
        const config = this.tableConfigs[tableName];
        if (config && config.airtableFile) {
            return config.airtableFile;
        }

        // Fallback vers l'ancien système
        return tableName.replace(/\s+/g, '_') + '.json';
    }

    private toCamelCase(str: string): string {
        return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, '');
    }

    private inferType(value: any): 'string' | 'number' | 'boolean' | 'date' {
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        if (value && typeof value === 'string' && /\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
        return 'string';
    }

    // Méthodes de résolution (à implémenter selon les besoins)
    private mapUserRole(role: any): string { /* ... */ return 'USER'; }
    private filterChauffeurs(roles: any): boolean { /* ... */ return true; }
    private async resolveMagasin(airtableId: any): Promise<string | null> { /* ... */ return null; }
    private async resolveClient(airtableId: any): Promise<string | null> { /* ... */ return null; }
    private async resolveCommande(airtableId: any): Promise<string | null> { /* ... */ return null; }
    private mapStatutCommande(statut: any): string { /* ... */ return 'En attente'; }

    private async checkExisting(model: string, airtableId: string): Promise<boolean> {
        // Logique de vérification existante
        return false;
    }

    private async createRecord(model: string, data: any): Promise<void> {
        // Logique de création existante
    }

    private async displayFinalResults(results: MigrationResult[]): Promise<void> {
        console.log('\n' + '='.repeat(80));
        console.log('📊 RAPPORT FINAL - MIGRATION EXTENSIBLE');
        console.log('='.repeat(80));

        let totalProcessed = 0;
        let totalSuccess = 0;
        let totalErrors = 0;

        console.log('┌─────────────────────────┬─────────┬─────────┬─────────┬──────────┐');
        console.log('│         Table           │ Traités │ Succès  │ Erreurs │   Taux   │');
        console.log('├─────────────────────────┼─────────┼─────────┼─────────┼──────────┤');

        for (const result of results) {
            totalProcessed += result.processed;
            totalSuccess += result.success;
            totalErrors += result.errors;

            const rate = result.processed > 0 ? (result.success / result.processed) * 100 : 0;
            const status = rate === 100 ? '✅' : rate >= 80 ? '⚠️' : '❌';

            console.log(`│ ${result.table.padEnd(23)} │ ${result.processed.toString().padStart(7)} │ ${result.success.toString().padStart(7)} │ ${result.errors.toString().padStart(7)} │ ${rate.toFixed(1).padStart(6)}% ${status} │`);
        }

        console.log('└─────────────────────────┴─────────┴─────────┴─────────┴──────────┘');

        const globalRate = totalProcessed > 0 ? (totalSuccess / totalProcessed) * 100 : 0;
        console.log(`\n🎯 RÉSULTAT GLOBAL: ${globalRate.toFixed(1)}% (${totalSuccess}/${totalProcessed})`);

        if (globalRate === 100) {
            console.log('🎉 MIGRATION PARFAITE - TOUTES LES TABLES MIGRÉES !');
        } else if (globalRate >= 95) {
            console.log('✅ MIGRATION EXCELLENTE');
        } else {
            console.log('⚠️ MIGRATION PARTIELLE - Vérifications nécessaires');
        }

        console.log('='.repeat(80));
    }
}

// Script principal
async function main() {
    const migrator = new ExtensibleMigrationSystem();

    const options = {
        tablesFilter: process.argv.includes('--tables')
            ? process.argv[process.argv.indexOf('--tables') + 1]?.split(',')
            : undefined,
        skipExisting: process.argv.includes('--skip-existing'),
        dryRun: process.argv.includes('--dry-run'),
        autoDetect: process.argv.includes('--auto-detect')
    };

    try {
        await migrator.executeExtensibleMigration(options);
        console.log('✅ Migration extensible terminée !');
    } catch (error) {
        console.error('❌ Échec migration extensible:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}