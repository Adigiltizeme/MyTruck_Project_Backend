import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface MigrationStats {
    success: number;
    errors: number;
    skipped: number;
    duplicates: number;
}

export class FinalMigrationCorrectSchema {
    private mappings = {
        magasins: new Map<string, string>(),
        clients: new Map<string, string>(),
        chauffeurs: new Map<string, string>()
    };

    async executeFinalMigration(): Promise<MigrationStats> {
        console.log('🎯 Migration finale avec schéma correct...\n');

        const stats: MigrationStats = {
            success: 0,
            errors: 0,
            skipped: 0,
            duplicates: 0
        };

        try {
            // 1. Créer les mappings
            await this.createMappings();

            // 2. Analyser l'état actuel  
            await this.analyzeCurrentState();

            // 3. Migrer avec les VRAIS noms de colonnes
            await this.migrateWithCorrectSchema(stats);

            // 4. Vérification finale
            await this.verifyFinalState();

        } catch (error) {
            console.error('❌ Erreur migration:', error);
            throw error;
        }

        this.displayResults(stats);
        return stats;
    }

    private async createMappings(): Promise<void> {
        console.log('🔗 Création des mappings...');

        // Magasins - utiliser les VRAIS noms de colonnes
        const magasins = await prisma.magasin.findMany({
            select: { id: true, airtableId: true, nom: true }
        });
        magasins.forEach(m => {
            if (m.airtableId) {
                this.mappings.magasins.set(m.airtableId, m.id);
            }
        });

        // Clients  
        const clients = await prisma.client.findMany({
            select: { id: true, airtableId: true, nom: true }
        });
        clients.forEach(c => {
            if (c.airtableId) {
                this.mappings.clients.set(c.airtableId, c.id);
            }
        });

        // Chauffeurs
        const chauffeurs = await prisma.chauffeur.findMany({
            select: { id: true, airtableId: true, nom: true }
        });
        chauffeurs.forEach(ch => {
            if (ch.airtableId) {
                this.mappings.chauffeurs.set(ch.airtableId, ch.id);
            }
        });

        console.log(`✅ Mappings: ${this.mappings.magasins.size} magasins, ${this.mappings.clients.size} clients, ${this.mappings.chauffeurs.size} chauffeurs\n`);
    }

    private async analyzeCurrentState(): Promise<void> {
        console.log('📋 Analyse de l\'état actuel...');

        const existingCommandes = await prisma.commande.findMany({
            select: { id: true, numeroCommande: true, airtableId: true }
        });

        console.log(`📦 ${existingCommandes.length} commandes déjà en base:`);
        existingCommandes.forEach(cmd => {
            const type = cmd.numeroCommande.includes('ARCHIVED_') ? '📁 Archivée' :
                cmd.airtableId ? '📥 Migrée' : '🆕 Nouvelle';
            console.log(`   ${type}: ${cmd.numeroCommande}`);
        });
        console.log();
    }

    private async migrateWithCorrectSchema(stats: MigrationStats): Promise<void> {
        console.log('📦 Migration avec schéma correct...');

        // Charger les données Airtable
        const commandesData = JSON.parse(
            fs.readFileSync('./data/airtable-export/Commandes.json', 'utf8')
        );

        console.log(`📋 ${commandesData.length} commandes Airtable à traiter\n`);

        for (const record of commandesData) {
            await this.migrateCommandeWithCorrectSchema(record, stats);
        }
    }

    private async migrateCommandeWithCorrectSchema(record: any, stats: MigrationStats): Promise<void> {
        try {
            const fields = record.fields;
            const airtableId = record.id;

            // Vérifier si déjà migrée
            const existing = await prisma.commande.findFirst({
                where: { airtableId: airtableId }
            });

            if (existing) {
                console.log(`⚠️ ${fields['NUMERO DE COMMANDE']} déjà migrée, ignorée`);
                stats.duplicates++;
                return;
            }

            // Validation des données
            if (!fields['NUMERO DE COMMANDE']) {
                console.warn('⚠️ Commande sans numéro, ignorée');
                stats.skipped++;
                return;
            }

            // Résoudre les relations
            const magasinAirtableId = fields['Magasins']?.[0];
            const clientAirtableId = fields['Clients']?.[0];

            const magasinId = this.mappings.magasins.get(magasinAirtableId);
            const clientId = this.mappings.clients.get(clientAirtableId);

            if (!magasinId) {
                console.warn(`⚠️ ${fields['NUMERO DE COMMANDE']}: magasin non trouvé (${magasinAirtableId})`);
                stats.skipped++;
                return;
            }

            if (!clientId) {
                console.warn(`⚠️ ${fields['NUMERO DE COMMANDE']}: client non trouvé (${clientAirtableId})`);
                stats.skipped++;
                return;
            }

            // Créer un numéro unique si conflit
            let numeroCommande = fields['NUMERO DE COMMANDE'];
            const existingWithSameNumero = await prisma.commande.findFirst({
                where: { numeroCommande }
            });

            if (existingWithSameNumero) {
                numeroCommande = `${numeroCommande}_MIGRATED_${Date.now()}`;
                console.log(`🔄 Numéro modifié pour éviter conflit: ${numeroCommande}`);
            }

            // Préparer les données avec les VRAIS noms de colonnes
            const commandeData = {
                id: uuidv4(),
                airtableId: airtableId,
                numeroCommande: numeroCommande,

                // Relations (VRAIS noms)
                magasinId: magasinId,
                clientId: clientId,

                // Données client (VRAIS noms selon l'erreur Prisma)
                // Note: L'erreur montre que clientNom n'existe pas dans le schéma
                // Donc on ne l'inclut pas

                // Adresse
                adresseLivraison: fields['ADRESSE DE LIVRAISON'] || '',
                typeAdresse: fields["TYPE D'ADRESSE"] || 'Domicile',
                batiment: fields['BÂTIMENT'] || '',
                interphoneCode: fields['INTERPHONE/CODE'] || '',
                etage: fields['ETAGE'] || '0',
                ascenseur: fields['ASCENSEUR'] === 'Oui',

                // Dates
                dateCommande: new Date(fields['DATE DE COMMANDE'] || new Date()),
                dateLivraison: new Date(fields['DATE DE LIVRAISON'] || new Date()),

                // Livraison
                creneauLivraison: fields['CRENEAU DE LIVRAISON'] || '',
                categorieVehicule: fields['CATEGORIE DE VEHICULE'] || '',
                optionEquipier: parseInt(fields['OPTION EQUIPIER DE MANUTENTION'] || '0'),

                // Articles
                nombreArticles: parseInt(fields['NOMBRE TOTAL D\'ARTICLES'] || '0'),
                detailsArticles: fields['DETAILS SUR LES ARTICLES'] || '',

                // Statuts
                statutCommande: this.mapStatutCommande(fields['STATUT DE LA COMMANDE']),
                statutLivraison: this.mapStatutLivraison(fields['STATUT DE LA LIVRAISON (ENCART MYTRUCK)']),

                // Financier (utiliser tarifHT au lieu de tarif_ht selon l'erreur)
                tarifHT: parseFloat(fields['TARIF HT'] || '0'),
                reserveTransport: fields['RESERVE TRANSPORT'] === 'OUI',

                // Divers (utiliser remarques au lieu de autres_remarques)
                remarques: fields['AUTRES REMARQUES'] || '',
                prenomVendeur: fields['PRENOM DU VENDEUR/INTERLOCUTEUR'] || '',
                telephoneClient: fields['TELEPHONE DU CLIENT'] || '',
                telephoneClient2: fields['TELEPHONE DU CLIENT 2'] || '',

                // Timestamps
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Créer la commande
            await prisma.commande.create({ data: commandeData });

            stats.success++;
            console.log(`✅ ${numeroCommande} migrée avec succès`);

        } catch (error) {
            console.error(`❌ Erreur migration ${record.id}:`, error);
            stats.errors++;
        }
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

    private async verifyFinalState(): Promise<void> {
        console.log('\n🔍 Vérification de l\'état final...');

        const totalCommandes = await prisma.commande.count();
        const commandesArchivees = await prisma.commande.count({
            where: { numeroCommande: { startsWith: 'ARCHIVED_' } }
        });
        const commandesMigrees = await prisma.commande.count({
            where: {
                airtableId: { not: null },
                numeroCommande: { not: { startsWith: 'ARCHIVED_' } }
            }
        });

        console.log(`📊 État final de la base:`);
        console.log(`   Total commandes: ${totalCommandes}`);
        console.log(`   Commandes archivées: ${commandesArchivees}`);
        console.log(`   Commandes migrées: ${commandesMigrees}`);
        console.log(`   Autres commandes: ${totalCommandes - commandesArchivees - commandesMigrees}`);
    }

    private displayResults(stats: MigrationStats): void {
        const total = stats.success + stats.errors + stats.skipped + stats.duplicates;

        console.log('\n🎯 ========== RÉSULTATS MIGRATION ==========');
        console.log(`\n📈 STATISTIQUES:`);
        console.log(`   ✅ Migrées avec succès: ${stats.success}`);
        console.log(`   ❌ Erreurs: ${stats.errors}`);
        console.log(`   ⚠️ Ignorées: ${stats.skipped}`);
        console.log(`   🔄 Doublons: ${stats.duplicates}`);
        console.log(`   📋 Total traitées: ${total}`);

        if (stats.success > 0) {
            console.log(`\n🎉 MIGRATION RÉUSSIE !`);
            console.log(`   ${stats.success} nouvelles commandes ajoutées à la base`);
        }

        console.log('\n==========================================\n');
    }
}

// Script principal
async function main() {
    const migrator = new FinalMigrationCorrectSchema();

    try {
        await migrator.executeFinalMigration();
        console.log('🎯 Migration terminée avec succès !');

    } catch (error) {
        console.error('❌ Échec de la migration:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}