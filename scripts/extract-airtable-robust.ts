import 'dotenv/config';
import Airtable from 'airtable';
import * as fs from 'fs';
import * as path from 'path';

interface AirtableRecord {
    id: string;
    fields: any;
    createdTime: string;
}

interface ExtractionResult {
    table: string;
    count: number;
    success: boolean;
    error?: string;
    duration?: number;
}

export class RobustAirtableExtractor {
    private base: any;
    private outputDir: string;

    constructor() {
        // Configuration depuis les variables d'environnement
        const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN ||
            process.env.AIRTABLE_API_KEY ||
            process.env.VITE_AIRTABLE_TOKEN;

        const baseId = process.env.AIRTABLE_BASE_ID ||
            process.env.VITE_AIRTABLE_BASE_ID;

        if (!apiKey || !baseId) {
            throw new Error('Token et Base ID Airtable requis');
        }

        console.log(`🔑 Token: ${apiKey.substring(0, 15)}...`);
        console.log(`📊 Base ID: ${baseId}`);

        this.base = new Airtable({ apiKey }).base(baseId);
        this.outputDir = path.join(__dirname, '../data/airtable-export');

        // Créer le dossier de sortie s'il n'existe pas
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async extractTable(tableName: string, timeoutMs: number = 30000): Promise<ExtractionResult> {
        const startTime = Date.now();
        console.log(`📥 [${new Date().toLocaleTimeString()}] Extraction de: ${tableName}`);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                console.log(`⏰ [${tableName}] Timeout après ${timeoutMs}ms`);
                resolve({
                    table: tableName,
                    count: 0,
                    success: false,
                    error: `Timeout après ${timeoutMs}ms`,
                    duration: Date.now() - startTime
                });
            }, timeoutMs);

            this.performExtraction(tableName, startTime)
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    console.log(`❌ [${tableName}] Erreur: ${error.message}`);
                    resolve({
                        table: tableName,
                        count: 0,
                        success: false,
                        error: error.message,
                        duration: Date.now() - startTime
                    });
                });
        });
    }

    private async performExtraction(tableName: string, startTime: number): Promise<ExtractionResult> {
        try {
            const records: AirtableRecord[] = [];

            // Utiliser une méthode avec pagination contrôlée
            await this.base(tableName)
                .select({
                    maxRecords: 1000, // Limiter pour éviter les timeouts
                    pageSize: 100     // Traiter par petits lots
                })
                .eachPage((pageRecords: any[], fetchNextPage: () => void) => {
                    console.log(`  📄 [${tableName}] Page de ${pageRecords.length} enregistrements...`);

                    pageRecords.forEach(record => {
                        records.push({
                            id: record.id,
                            fields: record.fields,
                            createdTime: record._rawJson.createdTime,
                        });
                    });

                    fetchNextPage();
                });

            // Sauvegarder les données
            const filename = `${tableName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            const filepath = path.join(this.outputDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(records, null, 2));

            const duration = Date.now() - startTime;
            console.log(`✅ [${tableName}] ${records.length} enregistrements en ${duration}ms → ${filename}`);

            return {
                table: tableName,
                count: records.length,
                success: true,
                duration
            };

        } catch (error) {
            throw error;
        }
    }

    async extractAllTables(): Promise<void> {
        // Tables prioritaires d'abord
        const priorityTables = [
            'Users',
            'Magasins',
            'Personnel My Truck',
            'Clients',
            'Commandes',
        ];

        // Tables secondaires
        const secondaryTables = [
            'Factures',
            'Devis',
            'Renseignements prestations (livraisons)',
            'Rapports à l\'enlèvement',
            'Rapports à la livraison',
            'Cessions Inter-magasins',
            'Historique',
        ];

        const allTables = [...priorityTables, ...secondaryTables];

        console.log(`🚀 [${new Date().toLocaleTimeString()}] Début extraction de ${allTables.length} tables`);
        console.log('📋 Ordre d\'extraction:', allTables.join(', '));

        const results: ExtractionResult[] = [];

        // Extraire une table à la fois pour éviter les conflits
        for (let i = 0; i < allTables.length; i++) {
            const tableName = allTables[i];
            console.log(`\n📊 [${i + 1}/${allTables.length}] ${tableName}`);

            // Timeout plus long pour les tables complexes
            const timeoutMs = tableName === 'Commandes' ? 60000 : 30000;

            const result = await this.extractTable(tableName, timeoutMs);
            results.push(result);

            // Petite pause entre les extractions
            if (i < allTables.length - 1) {
                console.log('⏳ Pause 2s...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Résumé final
        this.printSummary(results);
    }

    private printSummary(results: ExtractionResult[]) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RÉSUMÉ DE L\'EXTRACTION');
        console.log('='.repeat(60));

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        const totalRecords = successful.reduce((sum, r) => sum + r.count, 0);
        const totalTime = results.reduce((sum, r) => sum + (r.duration || 0), 0);

        console.log(`✅ Réussies: ${successful.length}/${results.length} tables`);
        console.log(`📈 Total: ${totalRecords} enregistrements extraits`);
        console.log(`⏱️  Durée totale: ${Math.round(totalTime / 1000)}s`);

        if (successful.length > 0) {
            console.log('\n✅ TABLES RÉUSSIES:');
            successful.forEach(result => {
                const duration = result.duration ? `${Math.round(result.duration / 1000)}s` : '?';
                console.log(`   📋 ${result.table}: ${result.count} enregistrements (${duration})`);
            });
        }

        if (failed.length > 0) {
            console.log('\n❌ TABLES ÉCHOUÉES:');
            failed.forEach(result => {
                console.log(`   ❌ ${result.table}: ${result.error}`);
            });
        }

        console.log('\n📁 Fichiers générés dans:', this.outputDir);

        // Lister les fichiers créés
        if (fs.existsSync(this.outputDir)) {
            const files = fs.readdirSync(this.outputDir).filter(f => f.endsWith('.json'));
            if (files.length > 0) {
                console.log('📄 Fichiers:');
                files.forEach(file => {
                    const filepath = path.join(this.outputDir, file);
                    const stats = fs.statSync(filepath);
                    const sizeKb = Math.round(stats.size / 1024);
                    console.log(`   📄 ${file} (${sizeKb} KB)`);
                });
            }
        }
    }

    // Méthode pour extraire une seule table (utile pour debug)
    async extractSingleTable(tableName: string): Promise<void> {
        console.log(`🎯 Extraction de la table: ${tableName}`);
        const result = await this.extractTable(tableName, 60000);
        this.printSummary([result]);
    }
}

// Script principal
async function main() {
    const command = process.argv[2];
    const tableName = process.argv[3];

    try {
        const extractor = new RobustAirtableExtractor();

        switch (command) {
            case 'extract':
                await extractor.extractAllTables();
                break;

            case 'single':
                if (!tableName) {
                    console.log('Usage: npm run extract:single -- "Nom de la table"');
                    process.exit(1);
                }
                await extractor.extractSingleTable(tableName);
                break;

            default:
                console.log('Usage:');
                console.log('  npm run extract:robust           - Extraire toutes les tables');
                console.log('  npm run extract:single "Clients" - Extraire une seule table');
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}