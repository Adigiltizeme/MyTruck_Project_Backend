import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

export class MissingTablesConfigFixer {

    async fixMissingTablesConfig(): Promise<void> {
        console.log('🔧 Correction des configurations de tables manquantes...\n');

        try {
            // 1. Analyser les fichiers disponibles
            await this.analyzeAvailableFiles();

            // 2. Créer les mappings corrects
            await this.createCorrectMappings();

            // 3. Tester la configuration
            await this.testNewConfiguration();

        } catch (error) {
            console.error('❌ Erreur correction config:', error);
        }
    }

    private async analyzeAvailableFiles(): Promise<void> {
        console.log('📁 Analyse des fichiers disponibles...');

        const exportDir = './data/airtable-export/';
        const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));

        console.log('📋 Fichiers trouvés:');
        files.forEach((file, index) => {
            const filePath = path.join(exportDir, file);
            try {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log(`   ${index + 1}. ${file} (${data.length} enregistrements)`);

                // Afficher quelques champs pour identifier la table
                if (data.length > 0 && data[0].fields) {
                    const fields = Object.keys(data[0].fields).slice(0, 3);
                    console.log(`      Champs: ${fields.join(', ')}...`);
                }
            } catch {
                console.log(`   ${index + 1}. ${file} (fichier invalide)`);
            }
        });

        console.log('\n🔍 Identification des correspondances:');

        // Correspondances détectées
        const mappings = [
            { file: 'Cessions_Inter_magasins.json', expectedConfig: 'Cessions Inter-magasins' },
            { file: 'Rapports___la_livraison.json', expectedConfig: 'Rapports à la livraison' },
            { file: 'Rapports___l_enl_vement.json', expectedConfig: 'Rapports à l\'enlèvement' },
            { file: 'Renseignements_prestations__livraisons_.json', expectedConfig: 'Renseignements prestations (livraisons)' }
        ];

        for (const mapping of mappings) {
            const exists = files.includes(mapping.file);
            console.log(`   ${exists ? '✅' : '❌'} ${mapping.file} → ${mapping.expectedConfig}`);
        }
    }

    private async createCorrectMappings(): Promise<void> {
        console.log('\n🛠️ Création des configurations corrigées...');

        // Configuration corrigée avec les vrais noms de fichiers
        const correctedConfigs = {
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
                    { airtableField: 'MAGASIN DE CESSION', postgresField: 'magasinOrigineId', type: 'relation', required: false },
                    { airtableField: 'ADRESSE DE LIVRAISON', postgresField: 'adresseLivraison', type: 'string', required: false }
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
                ]
            }
        };

        // Générer le code TypeScript corrigé
        console.log('📝 Configuration TypeScript corrigée:');
        console.log('='.repeat(60));

        for (const [tableName, config] of Object.entries(correctedConfigs)) {
            console.log(`'${tableName}': {`);
            console.log(`  airtableName: '${config.airtableName}',`);
            console.log(`  airtableFile: '${config.airtableFile}',`);
            console.log(`  postgresTable: '${config.postgresTable}',`);
            console.log(`  prismaModel: '${config.prismaModel}',`);
            console.log(`  priority: ${config.priority},`);
            console.log(`  dependencies: [${config.dependencies.map(d => `'${d}'`).join(', ')}],`);
            console.log(`  isActive: ${config.isActive},`);
            console.log(`  mapping: [`);
            config.mapping.forEach(m => {
                console.log(`    { airtableField: '${m.airtableField}', postgresField: '${m.postgresField}', type: '${m.type}', required: ${m.required} },`);
            });
            console.log(`  ]`);
            console.log(`},\n`);
        }

        console.log('='.repeat(60));
    }

    private async testNewConfiguration(): Promise<void> {
        console.log('\n🧪 Test de la nouvelle configuration...');

        const filesToTest = [
            'Cessions_Inter_magasins.json',
            'Rapports___la_livraison.json',
            'Rapports___l_enl_vement.json',
            'Renseignements_prestations__livraisons_.json'
        ];

        const exportDir = './data/airtable-export/';

        for (const file of filesToTest) {
            const filePath = path.join(exportDir, file);

            if (fs.existsSync(filePath)) {
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    console.log(`✅ ${file}: ${data.length} enregistrements`);

                    if (data.length > 0) {
                        const sampleFields = Object.keys(data[0].fields || {});
                        console.log(`   Champs disponibles: ${sampleFields.slice(0, 5).join(', ')}${sampleFields.length > 5 ? '...' : ''}`);
                    }
                } catch {
                    console.log(`❌ ${file}: fichier JSON invalide`);
                }
            } else {
                console.log(`❌ ${file}: fichier non trouvé`);
            }
        }
    }

    async generateUpdatedExtensibleScript(): Promise<void> {
        console.log('\n📝 Génération du script extensible mis à jour...');

        const updatedTableConfigs = `
    // Configuration mise à jour avec les vrais noms de fichiers
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
        { airtableField: 'MAGASIN DE CESSION', postgresField: 'magasinOrigineId', type: 'relation', required: false },
        { airtableField: 'ADRESSE DE LIVRAISON', postgresField: 'adresseLivraison', type: 'string', required: false }
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

    'Rapports à l\\'enlèvement': {
      airtableName: 'Rapports à l\\'enlèvement', 
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
      ]
    }`;

        console.log('📋 Configuration à ajouter au système extensible:');
        console.log(updatedTableConfigs);

        console.log('\n💡 Instructions:');
        console.log('1. Ajouter ces configurations au tableConfigs dans extensible-migration-system.ts');
        console.log('2. Relancer la migration avec: npx ts-node scripts/extensible-migration-system.ts --skip-existing');
        console.log('3. Vérifier que les 4 tables manquantes sont maintenant migrées');
    }
}

// Script principal
async function main() {
    const fixer = new MissingTablesConfigFixer();

    try {
        await fixer.fixMissingTablesConfig();
        await fixer.generateUpdatedExtensibleScript();

    } catch (error) {
        console.error('❌ Erreur script correction:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}