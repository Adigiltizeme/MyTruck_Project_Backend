// scripts/final-migration-real-schema.ts - Migration avec la VRAIE structure

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

export class FinalMigrationRealSchema {
    private mappings = {
        magasins: new Map<string, string>(),
        clients: new Map<string, string>(),
        chauffeurs: new Map<string, string>()
    };

    async executeFinalMigration(): Promise<MigrationStats> {
        console.log('🎯 Migration finale avec schéma réel vérifié...\n');

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

            // 3. Migrer avec la VRAIE structure
            await this.migrateWithRealSchema(stats);

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

        // Magasins
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

    private async migrateWithRealSchema(stats: MigrationStats): Promise<void> {
        console.log('📦 Migration avec schéma réel...');

        // Charger les données Airtable
        const commandesData = JSON.parse(
            fs.readFileSync('./data/airtable-export/Commandes.json', 'utf8')
        );

        console.log(`📋 ${commandesData.length} commandes Airtable à traiter\n`);

        for (const record of commandesData) {
            await this.migrateCommandeWithRealSchema(record, stats);
        }
    }

    private async migrateCommandeWithRealSchema(record: any, stats: MigrationStats): Promise<void> {
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

            // Préparer les données avec la VRAIE structure du schéma
            const commandeData = {
                // Champs obligatoires identifiés dans le schéma
                numeroCommande: numeroCommande,
                dateLivraison: new Date(fields['DATE DE LIVRAISON'] || new Date()),
                clientId: clientId,
                magasinId: magasinId,

                // Champs optionnels avec valeurs par défaut du schéma
                dateCommande: new Date(fields['DATE DE COMMANDE'] || new Date()),
                creneauLivraison: fields['CRENEAU DE LIVRAISON'] || null,
                statutCommande: this.mapStatutCommande(fields['STATUT DE LA COMMANDE']),
                statutLivraison: this.mapStatutLivraison(fields['STATUT DE LA LIVRAISON (ENCART MYTRUCK)']),
                tarifHT: parseFloat(fields['TARIF HT'] || '0'),
                reserveTransport: fields['RESERVE TRANSPORT'] === 'OUI',
                categorieVehicule: fields['CATEGORIE DE VEHICULE'] || null,
                optionEquipier: parseInt(fields['OPTION EQUIPIER DE MANUTENTION'] || '0'),
                prenomVendeur: fields['PRENOM DU VENDEUR/INTERLOCUTEUR'] || null,
                remarques: fields['AUTRES REMARQUES'] || null,
                airtableId: airtableId,
                lastSyncedAt: null
            };

            // Créer la commande
            await prisma.commande.create({ data: commandeData });

            stats.success++;
            console.log(`✅ ${numeroCommande} migrée avec succès`);

        } catch (error) {
            console.error(`❌ Erreur migration ${record.id}:`, error);
            console.error('Détails:', error.message);
            stats.errors++;
        }
    }

    private mapStatutCommande(statuts: string[]): string {
        if (!statuts || statuts.length === 0) return 'En attente'; // Valeur par défaut du schéma

        const statutMap: Record<string, string> = {
            'En attente': 'En attente',
            'Confirmée': 'Confirmée',
            'Transmise': 'Transmise',
            'Modifiée': 'Modifiée',
            'Annulée': 'Annulée'
        };

        return statutMap[statuts[0]] || 'En attente';
    }

    private mapStatutLivraison(statuts: string[]): string {
        if (!statuts || statuts.length === 0) return 'EN ATTENTE'; // Valeur par défaut du schéma

        const statutMap: Record<string, string> = {
            'EN ATTENTE': 'EN ATTENTE',
            'CONFIRMEE': 'CONFIRMEE',
            'EN COURS DE LIVRAISON': 'EN COURS',
            'LIVREE': 'LIVREE',
            'ANNULEE': 'ANNULEE',
            'ECHEC': 'ECHEC',
            'ENLEVEE': 'ENLEVEE'
        };

        return statutMap[statuts[0]] || 'EN ATTENTE';
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

        if (stats.success === total) {
            console.log(`\n🏆 MIGRATION PARFAITE - 100% de réussite !`);
        }

        console.log('\n==========================================\n');
    }
}

// Script principal
async function main() {
    const migrator = new FinalMigrationRealSchema();

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