import 'dotenv/config';
import Airtable from 'airtable';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';

interface AirtableRecord {
    id: string;
    fields: any;
    createdTime: string;
}

class AirtableExtractor {
    private base: any;
    private outputDir: string;

    constructor() {
        // Configuration depuis les variables d'environnement
        // Support des nouveaux Personal Access Tokens ET des anciennes API keys
        const apiKey = process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN ||
            process.env.AIRTABLE_API_KEY ||
            process.env.VITE_AIRTABLE_TOKEN;

        const baseId = process.env.AIRTABLE_BASE_ID ||
            process.env.VITE_AIRTABLE_BASE_ID;

        console.log('🔍 Variables d\'environnement détectées:');
        console.log('- AIRTABLE_PERSONAL_ACCESS_TOKEN:', apiKey ? 'Défini' : 'Non défini');
        console.log('- AIRTABLE_API_KEY:', process.env.AIRTABLE_API_KEY ? 'Défini' : 'Non défini');
        console.log('- VITE_AIRTABLE_TOKEN:', process.env.VITE_AIRTABLE_TOKEN ? 'Défini' : 'Non défini');
        console.log('- AIRTABLE_BASE_ID:', baseId ? 'Défini' : 'Non défini');
        console.log('- VITE_AIRTABLE_BASE_ID:', process.env.VITE_AIRTABLE_BASE_ID ? 'Défini' : 'Non défini');

        if (!apiKey || !baseId) {
            throw new Error(`
❌ Configuration Airtable manquante !

Veuillez définir dans votre fichier .env :

# Option 1 : Personal Access Token (recommandé)
AIRTABLE_PERSONAL_ACCESS_TOKEN=pat1.xxxxxxxxxxxxxxxx
AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxx

# Option 2 : Ancienne API Key
AIRTABLE_API_KEY=keyxxxxxxxxxxxxxxx
AIRTABLE_BASE_ID=appxxxxxxxxxxxxxxx

Variables actuellement définies:
- Token: ${apiKey ? 'Oui (' + apiKey.substring(0, 10) + '...)' : 'Non'}
- Base ID: ${baseId ? 'Oui (' + baseId.substring(0, 10) + '...)' : 'Non'}
      `);
        }

        console.log(`🔑 Utilisation du token: ${apiKey.substring(0, 15)}...`);
        console.log(`📊 Base ID: ${baseId}`);

        this.base = new Airtable({ apiKey }).base(baseId);
        this.outputDir = path.join(__dirname, '../data/airtable-export');

        // Créer le dossier de sortie s'il n'existe pas
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async extractTable(tableName: string): Promise<AirtableRecord[]> {
        console.log(`📥 Extraction de la table: ${tableName}`);

        try {
            const records = await this.base(tableName).select().all();

            const data = records.map(record => ({
                id: record.id,
                fields: record.fields,
                createdTime: record._rawJson.createdTime,
            }));

            // Sauvegarder les données dans un fichier JSON
            const filename = `${tableName.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            const filepath = path.join(this.outputDir, filename);

            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));

            console.log(`✅ ${data.length} enregistrements extraits de ${tableName} → ${filename}`);
            return data;
        } catch (error) {
            console.error(`❌ Erreur lors de l'extraction de ${tableName}:`, error.message);
            throw error;
        }
    }

    async extractAllTables(): Promise<void> {
        const tables = [
            'Users',
            'Magasins',
            'Personnel My Truck',
            'Clients',
            'Commandes',
            'Factures',
            'Devis',
            'Renseignements prestations (livraisons)',
            'Cessions Inter-magasins',
            'Rapports à l\'enlèvement',
            'Rapports à la livraison',
        ];

        console.log(`🚀 Début de l'extraction de ${tables.length} tables`);

        const results = [];

        for (const table of tables) {
            try {
                const data = await this.extractTable(table);
                results.push({ table, count: data.length, success: true });
            } catch (error) {
                console.error(`❌ Échec extraction ${table}:`, error.message);
                results.push({ table, count: 0, success: false, error: error.message });
            }
        }

        // Résumé
        console.log('\n📊 Résumé de l\'extraction:');
        results.forEach(result => {
            const status = result.success ? '✅' : '❌';
            console.log(`${status} ${result.table}: ${result.count} enregistrements`);
            if (!result.success) {
                console.log(`   Erreur: ${result.error}`);
            }
        });

        const totalRecords = results.reduce((sum, result) => sum + result.count, 0);
        const successCount = results.filter(r => r.success).length;

        console.log(`\n🎯 Total: ${totalRecords} enregistrements extraits`);
        console.log(`📈 Succès: ${successCount}/${tables.length} tables`);
    }
}

export { AirtableExtractor };