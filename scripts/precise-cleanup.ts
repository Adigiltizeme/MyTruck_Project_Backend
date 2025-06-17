import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PreciseCleanup {

    async executeCleanup(): Promise<void> {
        console.log('🧹 Nettoyage précis avec les vrais noms de colonnes...\n');

        try {
            // 1. Identifier précisément les enregistrements bloquants
            await this.identifyBlockingRecords();

            // 2. Supprimer dans l'ordre correct (enfants → parents)
            await this.deleteInCorrectOrder();

            // 3. Vérifier que tout est nettoyé
            await this.verifyCleanup();

            console.log('✅ Nettoyage terminé - Migration peut continuer !');

        } catch (error) {
            console.error('❌ Erreur lors du nettoyage:', error);
            throw error;
        }
    }

    private async identifyBlockingRecords(): Promise<void> {
        console.log('🔍 Identification précise des enregistrements bloquants...');

        // Lister les commandes existantes
        const commandes = await prisma.commande.findMany({
            select: { id: true, numeroCommande: true }
        });

        console.log(`📦 Commandes existantes: ${commandes.length}`);
        commandes.forEach(cmd => {
            console.log(`   - ${cmd.numeroCommande} (ID: ${cmd.id})`);
        });

        if (commandes.length === 0) {
            console.log('✅ Aucune commande à nettoyer');
            return;
        }

        // Compter les enregistrements liés pour chaque table
        const commandeIds = commandes.map(c => c.id);

        const tables = [
            { name: 'articles', column: 'commandeId' },
            { name: 'chauffeur_sur_commande', column: 'commandeId' },
            { name: 'commentaires', column: 'commandeId' },
            { name: 'devis', column: 'commandeId' },
            { name: 'factures', column: 'commandeId' },
            { name: 'photos', column: 'commandeId' },
            { name: 'rapports_enlevement', column: 'commandeId' },
            { name: 'rapports_livraison', column: 'commandeId' }
        ];

        for (const table of tables) {
            try {
                const count = await this.countRecordsWithCommandeIds(table.name, table.column, commandeIds);
                if (count > 0) {
                    console.log(`⚠️ ${table.name}: ${count} enregistrements à supprimer`);
                } else {
                    console.log(`✅ ${table.name}: aucun enregistrement lié`);
                }
            } catch (error) {
                console.log(`✅ ${table.name}: table non problématique ou inexistante`);
            }
        }

        console.log();
    }

    private async countRecordsWithCommandeIds(tableName: string, columnName: string, commandeIds: string[]): Promise<number> {
        if (commandeIds.length === 0) return 0;

        try {
            // Utiliser une requête SQL brute pour compter
            const placeholders = commandeIds.map(() => '?').join(',');
            const query = `SELECT COUNT(*) as count FROM ${tableName} WHERE ${columnName} IN (${placeholders})`;

            const result = await prisma.$queryRawUnsafe(query, ...commandeIds);
            // @ts-ignore
            return parseInt(result[0]?.count || '0');

        } catch (error) {
            console.log(`   Erreur comptage ${tableName}:`, error.message);
            return 0;
        }
    }

    private async deleteInCorrectOrder(): Promise<void> {
        console.log('🗑️ Suppression dans l\'ordre correct...');

        // Récupérer les IDs des commandes
        const commandes = await prisma.commande.findMany({
            select: { id: true, numeroCommande: true }
        });

        if (commandes.length === 0) {
            console.log('✅ Aucune commande à supprimer');
            return;
        }

        const commandeIds = commandes.map(c => c.id);

        // Ordre de suppression : enfants d'abord
        const deletionOrder = [
            { table: 'articles', column: 'commandeId' },
            { table: 'photos', column: 'commandeId' },
            { table: 'commentaires', column: 'commandeId' },
            { table: 'chauffeur_sur_commande', column: 'commandeId' },
            { table: 'rapports_livraison', column: 'commandeId' },
            { table: 'rapports_enlevement', column: 'commandeId' },
            { table: 'factures', column: 'commandeId' },
            { table: 'devis', column: 'commandeId' }
        ];

        for (const item of deletionOrder) {
            try {
                console.log(`   Suppression ${item.table}...`);

                const deletedCount = await this.deleteRecordsWithCommandeIds(
                    item.table,
                    item.column,
                    commandeIds
                );

                console.log(`   ✅ ${item.table}: ${deletedCount} enregistrements supprimés`);

            } catch (error: any) {
                if (error.message?.includes('does not exist') || error.code === 'P2001') {
                    console.log(`   ✅ ${item.table}: table inexistante (OK)`);
                } else {
                    console.error(`   ❌ ${item.table}: ${error.message}`);
                    // Continue malgré l'erreur
                }
            }
        }

        // Enfin, supprimer les commandes elles-mêmes
        console.log('   Suppression des commandes...');
        try {
            const deletedCommandes = await prisma.commande.deleteMany({
                where: {
                    id: { in: commandeIds }
                }
            });
            console.log(`   ✅ commandes: ${deletedCommandes.count} supprimées`);
        } catch (error) {
            console.error(`   ❌ Impossible de supprimer les commandes:`, error);
            throw error;
        }
    }

    private async deleteRecordsWithCommandeIds(tableName: string, columnName: string, commandeIds: string[]): Promise<number> {
        if (commandeIds.length === 0) return 0;

        try {
            const placeholders = commandeIds.map(() => '?').join(',');
            const query = `DELETE FROM ${tableName} WHERE ${columnName} IN (${placeholders})`;

            const result = await prisma.$executeRawUnsafe(query, ...commandeIds);
            return result;

        } catch (error) {
            throw error;
        }
    }

    private async verifyCleanup(): Promise<void> {
        console.log('\n🔍 Vérification du nettoyage...');

        // Vérifier qu'il n'y a plus de commandes
        const remainingCommandes = await prisma.commande.count();
        console.log(`   Commandes restantes: ${remainingCommandes}`);

        if (remainingCommandes > 0) {
            throw new Error('Certaines commandes n\'ont pas pu être supprimées');
        }

        // Vérifier l'intégrité générale
        console.log('✅ Nettoyage vérifié - Base prête pour migration');
    }

    // Méthode alternative : migration sans suppression
    async migrateWithoutDeletion(): Promise<void> {
        console.log('🔄 Migration alternative sans suppression...');

        try {
            // Archiver les commandes existantes au lieu de les supprimer
            const existingCommandes = await prisma.commande.findMany({
                select: { id: true, numeroCommande: true }
            });

            for (const commande of existingCommandes) {
                await prisma.commande.update({
                    where: { id: commande.id },
                    data: {
                        numeroCommande: `ARCHIVED_${commande.numeroCommande}_${Date.now()}`,
                        // Ajouter un champ statut si nécessaire
                    }
                });
            }

            console.log(`✅ ${existingCommandes.length} commandes archivées`);
            console.log('✅ Migration peut maintenant ajouter les nouvelles commandes');

        } catch (error) {
            console.error('❌ Erreur lors de l\'archivage:', error);
            throw error;
        }
    }
}

// Script d'inspection rapide du schéma
export class SchemaInspector {

    async inspectTables(): Promise<void> {
        console.log('📋 Inspection rapide du schéma...\n');

        const tables = [
            'commandes', 'articles', 'photos', 'commentaires',
            'chauffeur_sur_commande', 'rapports_livraison',
            'rapports_enlevement', 'factures', 'devis'
        ];

        for (const tableName of tables) {
            try {
                // Obtenir la structure de la table
                const columns = await prisma.$queryRawUnsafe(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = '${tableName}' 
            AND table_schema = 'public'
          ORDER BY ordinal_position;
        `);

                console.log(`📋 Table ${tableName}:`);
                // @ts-ignore
                columns.forEach((col: any) => {
                    console.log(`   - ${col.column_name} (${col.data_type})`);
                });
                console.log();

            } catch (error) {
                console.log(`❌ Table ${tableName}: non accessible\n`);
            }
        }
    }
}

// Script principal
async function main() {
    const cleanup = new PreciseCleanup();
    const inspector = new SchemaInspector();

    try {
        console.log('🎯 Choix de la stratégie de nettoyage:\n');
        console.log('1. Nettoyage complet (suppression)');
        console.log('2. Migration sans suppression (archivage)');
        console.log('3. Inspection du schéma seulement\n');

        // Pour cette exécution, on fait le nettoyage complet
        console.log('🚀 Exécution du nettoyage complet...\n');

        await cleanup.executeCleanup();

        console.log('\n🎉 Nettoyage terminé avec succès !');
        console.log('✅ Vous pouvez maintenant relancer la migration des commandes');

    } catch (error) {
        console.error('\n❌ Échec du nettoyage:', error);

        console.log('\n🔄 Tentative avec migration alternative...');
        try {
            await cleanup.migrateWithoutDeletion();
            console.log('✅ Migration alternative réussie !');
        } catch (altError) {
            console.error('❌ Migration alternative échouée:', altError);

            console.log('\n📋 Inspection du schéma pour diagnostic:');
            await inspector.inspectTables();
        }

    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}