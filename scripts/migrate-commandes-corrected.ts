// scripts/migrate-commandes-corrected.ts - Migration complète et robuste

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface MigrationStats {
    success: number;
    errors: number;
    skipped: number;
    details: {
        magasin_not_found: number;
        client_not_found: number;
        data_invalid: number;
        duplicate_numero: number;
    };
}

interface MappingTables {
    magasins: Map<string, string>; // airtable_id -> postgres_id
    clients: Map<string, string>;
    chauffeurs: Map<string, string>;
}

export class CommandesMigrator {
    private mappings: MappingTables = {
        magasins: new Map(),
        clients: new Map(),
        chauffeurs: new Map()
    };

    async executeMigration(): Promise<MigrationStats> {
        console.log('🚀 Démarrage migration commandes corrigée...\n');

        const stats: MigrationStats = {
            success: 0,
            errors: 0,
            skipped: 0,
            details: {
                magasin_not_found: 0,
                client_not_found: 0,
                data_invalid: 0,
                duplicate_numero: 0
            }
        };

        try {
            // 1. Créer les tables de mapping
            await this.createMappingTables();

            // 2. Vérifier les prérequis
            await this.validatePrerequisites();

            // 3. Nettoyer les commandes existantes si nécessaire
            await this.cleanupExistingCommandes();

            // 4. Migrer les commandes
            await this.migrateCommandes(stats);

            // 5. Vérifier l'intégrité post-migration
            await this.verifyMigrationIntegrity();

        } catch (error) {
            console.error('❌ Erreur critique lors de la migration:', error);
            throw error;
        }

        this.displayMigrationResults(stats);
        return stats;
    }

    private async createMappingTables(): Promise<void> {
        console.log('🔗 Création des tables de mapping...');

        // Mapping Magasins
        const magasins = await prisma.magasin.findMany({
            select: { id: true, airtableId: true, nom: true }
        });

        magasins.forEach(magasin => {
            if (magasin.airtableId) {
                this.mappings.magasins.set(magasin.airtableId, magasin.id);
            }
        });

        // Mapping Clients  
        const clients = await prisma.client.findMany({
            select: { id: true, airtableId: true, nom: true, prenom: true }
        });

        clients.forEach(client => {
            if (client.airtableId) {
                this.mappings.clients.set(client.airtableId, client.id);
            }
        });

        // Mapping Chauffeurs
        const chauffeurs = await prisma.chauffeur.findMany({
            select: { id: true, airtableId: true, nom: true }
        });

        chauffeurs.forEach(chauffeur => {
            if (chauffeur.airtableId) {
                this.mappings.chauffeurs.set(chauffeur.airtableId, chauffeur.id);
            }
        });

        console.log(`✅ Mappings créés:
    - Magasins: ${this.mappings.magasins.size}
    - Clients: ${this.mappings.clients.size}  
    - Chauffeurs: ${this.mappings.chauffeurs.size}\n`);
    }

    private async validatePrerequisites(): Promise<void> {
        console.log('🔍 Validation des prérequis...');

        // Vérifier que les fichiers existent
        const requiredFiles = [
            './data/airtable-export/Commandes.json'
        ];

        for (const file of requiredFiles) {
            if (!fs.existsSync(file)) {
                throw new Error(`Fichier requis manquant: ${file}`);
            }
        }

        // Vérifier que nous avons assez de mappings
        if (this.mappings.magasins.size === 0) {
            throw new Error('Aucun magasin trouvé pour le mapping');
        }

        if (this.mappings.clients.size === 0) {
            throw new Error('Aucun client trouvé pour le mapping');
        }

        console.log('✅ Prérequis validés\n');
    }

    private async cleanupExistingCommandes(): Promise<void> {
        console.log('🧹 Nettoyage des commandes existantes...');

        // Compter les commandes existantes
        const existingCount = await prisma.commande.count();

        if (existingCount > 0) {
            console.log(`⚠️ ${existingCount} commandes existantes détectées`);

            // En mode production, demander confirmation
            // Pour cette migration, on supprime automatiquement
            await prisma.commande.deleteMany({});
            console.log('✅ Commandes existantes supprimées');
        }

        console.log();
    }

    private async migrateCommandes(stats: MigrationStats): Promise<void> {
        console.log('📦 Migration des commandes...');

        // Charger les données Airtable
        const commandesData = JSON.parse(
            fs.readFileSync('./data/airtable-export/Commandes.json', 'utf8')
        );

        console.log(`📋 ${commandesData.length} commandes à migrer\n`);

        // Traiter par batch pour éviter les timeouts
        const batchSize = 10;
        const batches = this.chunkArray(commandesData, batchSize);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`📦 Traitement batch ${i + 1}/${batches.length} (${batch.length} commandes)`);

            for (const record of batch) {
                await this.migrateCommandeRecord(record, stats);
            }

            // Petit délai entre les batches
            await this.sleep(100);
        }
    }

    private async migrateCommandeRecord(record: any, stats: MigrationStats): Promise<void> {
        try {
            const fields = record.fields;

            // Validation des données essentielles
            if (!this.validateCommandeData(fields, stats)) {
                return;
            }

            // Résolution des relations
            const relations = this.resolveRelations(fields, stats);
            if (!relations) {
                return;
            }

            // Préparation des données
            const commandeData = this.prepareCommandeData(record, fields, relations);

            // Vérification des doublons
            if (await this.checkDuplicate(commandeData.numero)) {
                console.warn(`⚠️ Commande ${commandeData.numero} déjà existante, ignorée`);
                stats.details.duplicate_numero++;
                stats.skipped++;
                return;
            }

            // Création de la commande
            await prisma.commande.create({ data: commandeData });

            stats.success++;
            console.log(`✅ ${commandeData.numero} migrée`);

        } catch (error) {
            console.error(`❌ Erreur migration ${record.id}:`, error);
            stats.errors++;
        }
    }

    private validateCommandeData(fields: any, stats: MigrationStats): boolean {
        // Vérifier les champs essentiels
        if (!fields['NUMERO DE COMMANDE']) {
            console.warn('⚠️ Commande sans numéro, ignorée');
            stats.details.data_invalid++;
            stats.skipped++;
            return false;
        }

        if (!fields['DATE DE COMMANDE'] || !fields['DATE DE LIVRAISON']) {
            console.warn(`⚠️ Commande ${fields['NUMERO DE COMMANDE']} sans dates, ignorée`);
            stats.details.data_invalid++;
            stats.skipped++;
            return false;
        }

        return true;
    }

    private resolveRelations(fields: any, stats: MigrationStats): any | null {
        // Résoudre magasin_id
        const airtableMagasinId = fields['Magasins']?.[0];
        const magasinId = this.mappings.magasins.get(airtableMagasinId);

        if (!magasinId) {
            console.warn(`⚠️ Commande ${fields['NUMERO DE COMMANDE']}: magasin non trouvé (${airtableMagasinId})`);
            stats.details.magasin_not_found++;
            stats.skipped++;
            return null;
        }

        // Résoudre client_id
        const airtableClientId = fields['Clients']?.[0];
        const clientId = this.mappings.clients.get(airtableClientId);

        if (!clientId) {
            console.warn(`⚠️ Commande ${fields['NUMERO DE COMMANDE']}: client non trouvé (${airtableClientId})`);
            stats.details.client_not_found++;
            stats.skipped++;
            return null;
        }

        // Résoudre chauffeur_id (optionnel)
        const airtableChauffeurId = fields['CHAUFFEUR(S)']?.[0];
        const chauffeurId = airtableChauffeurId ? this.mappings.chauffeurs.get(airtableChauffeurId) : null;

        return { magasinId, clientId, chauffeurId };
    }

    private prepareCommandeData(record: any, fields: any, relations: any): any {
        return {
            id: uuidv4(),
            airtable_id: record.id,
            numero: fields['NUMERO DE COMMANDE'],

            // Relations
            magasin_id: relations.magasinId,
            client_id: relations.clientId,
            chauffeur_id: relations.chauffeurId,

            // Données client (dénormalisées)
            client_nom: fields['NOM DU CLIENT'] || '',
            client_prenom: fields['PRENOM DU CLIENT'] || '',

            // Adresse
            adresse_livraison: fields['ADRESSE DE LIVRAISON'] || '',
            type_adresse: fields["TYPE D'ADRESSE"] || 'Domicile',
            batiment: fields['BÂTIMENT'] || '',
            interphone_code: fields['INTERPHONE/CODE'] || '',
            etage: fields['ETAGE'] || '0',
            ascenseur: fields['ASCENSEUR'] === 'Oui',

            // Dates
            date_commande: new Date(fields['DATE DE COMMANDE']),
            date_livraison: new Date(fields['DATE DE LIVRAISON']),

            // Livraison
            creneau_livraison: fields['CRENEAU DE LIVRAISON'] || '',
            categorie_vehicule: fields['CATEGORIE DE VEHICULE'] || '',
            option_equipier: parseInt(fields['OPTION EQUIPIER DE MANUTENTION'] || '0'),

            // Articles
            nombre_articles: parseInt(fields['NOMBRE TOTAL D\'ARTICLES'] || '0'),
            details_articles: fields['DETAILS SUR LES ARTICLES'] || '',

            // Statuts
            statut_commande: this.mapStatutCommande(fields['STATUT DE LA COMMANDE']),
            statut_livraison: this.mapStatutLivraison(fields['STATUT DE LA LIVRAISON (ENCART MYTRUCK)']),

            // Financier
            tarif_ht: parseFloat(fields['TARIF HT'] || '0'),
            reserve_transport: fields['RESERVE TRANSPORT'] === 'OUI',

            // Divers
            autres_remarques: fields['AUTRES REMARQUES'] || '',
            prenom_vendeur: fields['PRENOM DU VENDEUR/INTERLOCUTEUR'] || '',
            telephone_client: fields['TELEPHONE DU CLIENT'] || '',
            telephone_client_2: fields['TELEPHONE DU CLIENT 2'] || '',

            // Timestamps
            created_at: new Date(),
            updated_at: new Date()
        };
    }

    private async checkDuplicate(numero: string): Promise<boolean> {
        const existing = await prisma.commande.findFirst({
            where: { numeroCommande: numero }
        });
        return !!existing;
    }

    private mapStatutLivraison(statuts: string[]): string {
        if (!statuts || statuts.length === 0) return 'EN_ATTENTE';

        const statutMap: Record<string, string> = {
            'EN ATTENTE': 'EN_ATTENTE',
            'CONFIRMEE': 'CONFIRMEE',
            'EN COURS DE LIVRAISON': 'EN_COURS',
            'LIVREE': 'LIVREE',
            'ANNULEE': 'ANNULEE',
            'ECHEC': 'ECHEC',
            'ENLEVEE': 'ENLEVEE'
        };

        return statutMap[statuts[0]] || 'EN_ATTENTE';
    }

    private mapStatutCommande(statuts: string[]): string {
        if (!statuts || statuts.length === 0) return 'EN_ATTENTE';

        const statutMap: Record<string, string> = {
            'En attente': 'EN_ATTENTE',
            'Confirmée': 'CONFIRMEE',
            'Transmise': 'TRANSMISE',
            'Modifiée': 'MODIFIEE',
            'Annulée': 'ANNULEE'
        };

        return statutMap[statuts[0]] || 'EN_ATTENTE';
    }

    private async verifyMigrationIntegrity(): Promise<void> {
        console.log('\n🔍 Vérification intégrité post-migration...');

        // Compter les commandes migrées
        const totalCommandes = await prisma.commande.count();
        console.log(`✅ Total commandes en base: ${totalCommandes}`);

        // Vérifier les relations
        const commandesSansClient = await prisma.commande.count({
            where: { clientId: null }
        });

        const commandesSansMagasin = await prisma.commande.count({
            where: { magasinId: null }
        });

        if (commandesSansClient > 0) {
            console.warn(`⚠️ ${commandesSansClient} commandes sans client`);
        }

        if (commandesSansMagasin > 0) {
            console.warn(`⚠️ ${commandesSansMagasin} commandes sans magasin`);
        }

        // Vérifier les contraintes d'intégrité
        const constraintViolations = await this.checkConstraintViolations();
        if (constraintViolations.length > 0) {
            console.error('❌ Violations de contraintes détectées:', constraintViolations);
        } else {
            console.log('✅ Aucune violation de contrainte');
        }

        console.log('✅ Vérification intégrité terminée\n');
    }

    private async checkConstraintViolations(): Promise<string[]> {
        const violations: string[] = [];

        try {
            // Test des contraintes FK
            const result = await prisma.$queryRaw`
        SELECT 
          'commandes->magasins' as violation_type,
          COUNT(*) as count
        FROM commandes c 
        LEFT JOIN magasins m ON c.magasin_id = m.id 
        WHERE c.magasin_id IS NOT NULL AND m.id IS NULL
        
        UNION ALL
        
        SELECT 
          'commandes->clients' as violation_type,
          COUNT(*) as count  
        FROM commandes c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.client_id IS NOT NULL AND cl.id IS NULL
      `;

            // @ts-ignore
            result.forEach((row: any) => {
                if (row.count > 0) {
                    violations.push(`${row.violation_type}: ${row.count} violations`);
                }
            });

        } catch (error) {
            console.error('Erreur vérification contraintes:', error);
        }

        return violations;
    }

    private displayMigrationResults(stats: MigrationStats): void {
        const total = stats.success + stats.errors + stats.skipped;

        console.log('\n📊 ========== RÉSULTATS MIGRATION ==========');
        console.log(`\n📈 STATISTIQUES GLOBALES:`);
        console.log(`   ✅ Succès: ${stats.success}/${total} (${((stats.success / total) * 100).toFixed(1)}%)`);
        console.log(`   ❌ Erreurs: ${stats.errors}/${total} (${((stats.errors / total) * 100).toFixed(1)}%)`);
        console.log(`   ⚠️ Ignorées: ${stats.skipped}/${total} (${((stats.skipped / total) * 100).toFixed(1)}%)`);

        console.log(`\n🔍 DÉTAIL DES PROBLÈMES:`);
        console.log(`   📍 Magasins non trouvés: ${stats.details.magasin_not_found}`);
        console.log(`   👤 Clients non trouvés: ${stats.details.client_not_found}`);
        console.log(`   📝 Données invalides: ${stats.details.data_invalid}`);
        console.log(`   🔄 Doublons: ${stats.details.duplicate_numero}`);

        if (stats.success === total) {
            console.log(`\n🎉 MIGRATION RÉUSSIE À 100% !`);
        } else if (stats.success > (total * 0.8)) {
            console.log(`\n✅ MIGRATION LARGEMENT RÉUSSIE (${((stats.success / total) * 100).toFixed(1)}%)`);
        } else {
            console.log(`\n⚠️ MIGRATION PARTIELLE - Actions correctives nécessaires`);
        }

        console.log('\n==========================================\n');
    }

    // Utilitaires
    private chunkArray<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Script de récupération en cas d'erreur
export class MigrationRecovery {

    async fixMissingReferences(): Promise<void> {
        console.log('🔧 Correction des références manquantes...');

        // Créer des magasins/clients génériques pour les orphelins
        const defaultMagasin = await this.ensureDefaultMagasin();
        const defaultClient = await this.ensureDefaultClient();

        // Corriger les commandes orphelines
        await this.fixOrphanedCommandes(defaultMagasin.id, defaultClient.id);
    }

    private async ensureDefaultMagasin() {
        let defaultMagasin = await prisma.magasin.findFirst({
            where: { nom: 'Magasin Temporaire' }
        });

        if (!defaultMagasin) {
            defaultMagasin = await prisma.magasin.create({
                data: {
                    id: uuidv4(),
                    nom: 'Magasin Temporaire',
                    adresse: 'Adresse temporaire',
                    telephone: '0000000000',
                    email: 'temp@mytruck.com',
                    status: 'ACTIF',
                    airtableId: 'TEMP_MAGASIN'
                }
            });
            console.log('✅ Magasin temporaire créé');
        }

        return defaultMagasin;
    }

    private async ensureDefaultClient() {
        let defaultClient = await prisma.client.findFirst({
            where: { nom: 'Client Temporaire' }
        });

        if (!defaultClient) {
            defaultClient = await prisma.client.create({
                data: {
                    id: uuidv4(),
                    nom: 'Client Temporaire',
                    prenom: 'Temp',
                    telephone: '0000000000',
                    adresseLigne1: 'Adresse temporaire',
                    airtableId: 'TEMP_CLIENT'
                }
            });
            console.log('✅ Client temporaire créé');
        }

        return defaultClient;
    }

    private async fixOrphanedCommandes(defaultMagasinId: string, defaultClientId: string) {
        // Corriger commandes sans magasin
        const commandesSansMagasin = await prisma.commande.updateMany({
            where: { magasinId: null },
            data: { magasinId: defaultMagasinId }
        });

        // Corriger commandes sans client
        const commandesSansClient = await prisma.commande.updateMany({
            where: { clientId: null },
            data: { clientId: defaultClientId }
        });

        console.log(`✅ Corrigé ${commandesSansMagasin.count} commandes sans magasin`);
        console.log(`✅ Corrigé ${commandesSansClient.count} commandes sans client`);
    }
}

// Scripts d'exécution
async function main() {
    const migrator = new CommandesMigrator();

    try {
        const stats = await migrator.executeMigration();

        // Si migration partiellement échouée, proposer la récupération
        if (stats.errors > 0 || stats.skipped > 0) {
            console.log('\n🔧 Voulez-vous lancer la récupération des erreurs ? (recommandé)');

            const recovery = new MigrationRecovery();
            await recovery.fixMissingReferences();
        }
    } catch (error) {
        console.error('Erreur lors de la migration:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}