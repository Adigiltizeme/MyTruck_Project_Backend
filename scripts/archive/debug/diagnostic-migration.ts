// scripts/diagnostic-migration.ts - Audit complet avant correction

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface DiagnosticResult {
    database: {
        magasins: number;
        clients: number;
        commandes: number;
        users: number;
        chauffeurs: number;
    };
    airtable: {
        total_records: number;
        commandes_count: number;
        magasins_refs: string[];
        clients_refs: string[];
    };
    mapping_issues: {
        missing_magasins: string[];
        missing_clients: string[];
        orphaned_commandes: any[];
    };
    data_quality: {
        commandes_sans_numero: number;
        dates_invalides: number;
        references_nulles: number;
    };
}

export class MigrationDiagnostic {

    async runCompleteDiagnostic(): Promise<DiagnosticResult> {
        console.log('🔍 Démarrage diagnostic complet migration...\n');

        const result: DiagnosticResult = {
            database: await this.auditDatabase(),
            airtable: await this.auditAirtableData(),
            mapping_issues: { missing_magasins: [], missing_clients: [], orphaned_commandes: [] },
            data_quality: { commandes_sans_numero: 0, dates_invalides: 0, references_nulles: 0 }
        };

        // Analyser les problèmes de mapping
        result.mapping_issues = await this.analyzeMappingIssues(result.airtable);

        // Analyser la qualité des données
        result.data_quality = await this.analyzeDataQuality();

        // Afficher le rapport
        this.displayDiagnosticReport(result);

        return result;
    }

    private async auditDatabase() {
        console.log('📊 Audit base PostgreSQL...');

        const [magasins, clients, commandes, users, chauffeurs] = await Promise.all([
            prisma.magasin.count(),
            prisma.client.count(),
            prisma.commande.count(),
            prisma.user.count(),
            prisma.chauffeur.count()
        ]);

        console.log(`✅ Base PostgreSQL:
    - Magasins: ${magasins}
    - Clients: ${clients}  
    - Commandes: ${commandes}
    - Users: ${users}
    - Chauffeurs: ${chauffeurs}\n`);

        return { magasins, clients, commandes, users, chauffeurs };
    }

    private async auditAirtableData() {
        console.log('📋 Audit données Airtable exportées...');

        let commandesData = [];
        let total_records = 0;

        try {
            // Charger les données Commandes Airtable
            const commandesRaw = fs.readFileSync('./data/airtable-export/Commandes.json', 'utf8');
            commandesData = JSON.parse(commandesRaw);

            // Compter tous les exports
            const files = ['Commandes.json', 'Magasins.json', 'Clients.json', 'Users.json'];
            for (const file of files) {
                try {
                    const data = JSON.parse(fs.readFileSync(`./data/airtable-export/${file}`, 'utf8'));
                    total_records += data.length;
                } catch (e) {
                    console.warn(`⚠️ Fichier ${file} non trouvé`);
                }
            }
        } catch (error) {
            console.error('❌ Erreur lecture données Airtable:', error);
            return { total_records: 0, commandes_count: 0, magasins_refs: [], clients_refs: [] };
        }

        // Extraire les références utilisées
        const magasins_refs = [...new Set(
            commandesData
                .map(r => r.fields['Magasins']?.[0])
                .filter(Boolean)
        )];

        const clients_refs = [...new Set(
            commandesData
                .map(r => r.fields['Clients']?.[0])
                .filter(Boolean)
        )];

        console.log(`✅ Données Airtable:
    - Total records exportés: ${total_records}
    - Commandes à migrer: ${commandesData.length}
    - Références magasins: ${magasins_refs.length}
    - Références clients: ${clients_refs.length}\n`);

        return {
            total_records,
            commandes_count: commandesData.length,
            magasins_refs,
            clients_refs
        };
    }

    private async analyzeMappingIssues(airtableData: any) {
        console.log('🔗 Analyse problèmes de mapping...');

        // Récupérer les IDs Airtable existants en base
        const [magasinsInDB, clientsInDB] = await Promise.all([
            prisma.magasin.findMany({ select: { airtableId: true, nom: true } }),
            prisma.client.findMany({ select: { airtableId: true, nom: true, prenom: true } })
        ]);

        const magasinIds = new Set(magasinsInDB.map(m => m.airtableId).filter(Boolean));
        const clientIds = new Set(clientsInDB.map(c => c.airtableId).filter(Boolean));

        // Identifier les références manquantes
        const missing_magasins = airtableData.magasins_refs.filter(id => !magasinIds.has(id));
        const missing_clients = airtableData.clients_refs.filter(id => !clientIds.has(id));

        // Charger les commandes pour identifier les orphelines
        const commandesData = JSON.parse(fs.readFileSync('./data/airtable-export/Commandes.json', 'utf8'));
        const orphaned_commandes = commandesData.filter(cmd => {
            const magasinRef = cmd.fields['Magasins']?.[0];
            const clientRef = cmd.fields['Clients']?.[0];
            return !magasinIds.has(magasinRef) || !clientIds.has(clientRef);
        }).map(cmd => ({
            id: cmd.id,
            numero: cmd.fields['NUMERO DE COMMANDE'],
            magasin_ref: cmd.fields['Magasins']?.[0],
            client_ref: cmd.fields['Clients']?.[0]
        }));

        console.log(`🔍 Problèmes de mapping détectés:
    - Magasins manquants: ${missing_magasins.length}
    - Clients manquants: ${missing_clients.length}  
    - Commandes orphelines: ${orphaned_commandes.length}\n`);

        return { missing_magasins, missing_clients, orphaned_commandes };
    }

    private async analyzeDataQuality() {
        console.log('🧹 Analyse qualité des données...');

        const commandesData = JSON.parse(fs.readFileSync('./data/airtable-export/Commandes.json', 'utf8'));

        let commandes_sans_numero = 0;
        let dates_invalides = 0;
        let references_nulles = 0;

        commandesData.forEach(cmd => {
            const fields = cmd.fields;

            // Vérifier numéro de commande
            if (!fields['NUMERO DE COMMANDE']) {
                commandes_sans_numero++;
            }

            // Vérifier dates
            if (!fields['DATE DE COMMANDE'] || !fields['DATE DE LIVRAISON']) {
                dates_invalides++;
            }

            // Vérifier références essentielles
            if (!fields['Magasins']?.[0] || !fields['Clients']?.[0]) {
                references_nulles++;
            }
        });

        console.log(`📈 Qualité des données:
    - Commandes sans numéro: ${commandes_sans_numero}
    - Dates invalides: ${dates_invalides}
    - Références nulles: ${references_nulles}\n`);

        return { commandes_sans_numero, dates_invalides, references_nulles };
    }

    private displayDiagnosticReport(result: DiagnosticResult) {
        console.log('\n📋 ========== RAPPORT DIAGNOSTIC ==========\n');

        // État général
        const migrationRate = (result.database.commandes / result.airtable.commandes_count) * 100;
        console.log(`📊 ÉTAT MIGRATION: ${result.database.commandes}/${result.airtable.commandes_count} commandes (${migrationRate.toFixed(1)}%)\n`);

        // Problèmes critiques
        const criticalIssues = result.mapping_issues.orphaned_commandes.length;
        if (criticalIssues > 0) {
            console.log(`🚨 PROBLÈMES CRITIQUES: ${criticalIssues} commandes ne peuvent pas être migrées\n`);

            console.log('❌ Détail des commandes problématiques:');
            result.mapping_issues.orphaned_commandes.slice(0, 5).forEach(cmd => {
                console.log(`   - ${cmd.numero}: magasin=${cmd.magasin_ref}, client=${cmd.client_ref}`);
            });
            if (result.mapping_issues.orphaned_commandes.length > 5) {
                console.log(`   ... et ${result.mapping_issues.orphaned_commandes.length - 5} autres`);
            }
            console.log();
        }

        // Recommandations
        console.log('💡 RECOMMANDATIONS:');

        if (result.mapping_issues.missing_magasins.length > 0) {
            console.log(`   1. Migrer ${result.mapping_issues.missing_magasins.length} magasins manquants`);
        }

        if (result.mapping_issues.missing_clients.length > 0) {
            console.log(`   2. Migrer ${result.mapping_issues.missing_clients.length} clients manquants`);
        }

        if (result.data_quality.commandes_sans_numero > 0) {
            console.log(`   3. Corriger ${result.data_quality.commandes_sans_numero} commandes sans numéro`);
        }

        console.log('\n==========================================\n');
    }

    async generateMigrationPlan(): Promise<string[]> {
        const result = await this.runCompleteDiagnostic();
        const plan: string[] = [];

        if (result.mapping_issues.missing_magasins.length > 0) {
            plan.push(`Étape 1: Migrer ${result.mapping_issues.missing_magasins.length} magasins manquants`);
        }

        if (result.mapping_issues.missing_clients.length > 0) {
            plan.push(`Étape 2: Migrer ${result.mapping_issues.missing_clients.length} clients manquants`);
        }

        plan.push(`Étape 3: Corriger et migrer ${result.airtable.commandes_count - result.mapping_issues.orphaned_commandes.length} commandes valides`);

        if (result.mapping_issues.orphaned_commandes.length > 0) {
            plan.push(`Étape 4: Traiter manuellement ${result.mapping_issues.orphaned_commandes.length} commandes orphelines`);
        }

        return plan;
    }
}

// Script d'exécution
async function main() {
    const diagnostic = new MigrationDiagnostic();

    try {
        await diagnostic.runCompleteDiagnostic();

        console.log('📋 Plan de migration recommandé:');
        const plan = await diagnostic.generateMigrationPlan();
        plan.forEach((step, index) => {
            console.log(`   ${index + 1}. ${step}`);
        });

    } catch (error) {
        console.error('❌ Erreur lors du diagnostic:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}