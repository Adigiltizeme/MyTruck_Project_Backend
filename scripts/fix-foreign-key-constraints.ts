import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ForeignKeyConstraintsFixer {

    async analyzeAndFixConstraints(): Promise<void> {
        console.log('🔍 Analyse des contraintes de clés étrangères...\n');

        try {
            // 1. Identifier les relations qui bloquent la suppression
            await this.analyzeBlockingRelations();

            // 2. Supprimer les enregistrements liés en cascade
            await this.cleanupCascade();

            // 3. Vérifier que tout est nettoyé
            await this.verifyCleanup();

            console.log('✅ Contraintes FK résolues - Migration peut continuer\n');

        } catch (error) {
            console.error('❌ Erreur lors de la correction FK:', error);
            throw error;
        }
    }

    private async analyzeBlockingRelations(): Promise<void> {
        console.log('🔍 Identification des relations bloquantes...');

        // Vérifier les tables qui référencent les commandes
        const tablesWithCommandeFK = [
            'factures',
            'devis',
            'rapports_enlevement',
            'rapports_livraison',
            'historique'
        ];

        for (const tableName of tablesWithCommandeFK) {
            try {
                // Compter les enregistrements liés aux commandes existantes
                const count = await this.countRelatedRecords(tableName);
                if (count > 0) {
                    console.log(`⚠️ ${tableName}: ${count} enregistrements liés aux commandes`);
                }
            } catch (error) {
                console.log(`✅ ${tableName}: table non problématique`);
            }
        }
    }

    private async countRelatedRecords(tableName: string): Promise<number> {
        try {
            // Requête générique pour compter les enregistrements liés
            const result = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*) as count 
        FROM ${tableName} 
        WHERE commande_id IN (SELECT id FROM commandes)
      `);

            // @ts-ignore
            return parseInt(result[0]?.count || '0');
        } catch (error) {
            // Si la requête échoue, la table n'existe pas ou n'a pas de FK
            return 0;
        }
    }

    private async cleanupCascade(): Promise<void> {
        console.log('🧹 Nettoyage en cascade des enregistrements liés...');

        // Liste des tables à nettoyer dans l'ordre (enfants d'abord)
        const tablesToClean = [
            'rapports_livraison',
            'rapports_enlevement',
            'factures',
            'devis',
            'historique'
        ];

        for (const tableName of tablesToClean) {
            try {
                console.log(`   Nettoyage ${tableName}...`);

                // Supprimer tous les enregistrements liés aux commandes
                const result = await prisma.$executeRawUnsafe(`
          DELETE FROM ${tableName} 
          WHERE commande_id IN (SELECT id FROM commandes)
        `);

                console.log(`   ✅ ${tableName}: ${result} enregistrements supprimés`);

            } catch (error: any) {
                if (error.code === 'P2001' || error.message.includes('does not exist')) {
                    console.log(`   ✅ ${tableName}: table non existante (OK)`);
                } else {
                    console.error(`   ❌ ${tableName}: ${error.message}`);
                }
            }
        }

        // Maintenant supprimer les commandes elles-mêmes
        console.log('   Suppression des commandes...');
        const deletedCommandes = await prisma.commande.deleteMany({});
        console.log(`   ✅ commandes: ${deletedCommandes.count} supprimées`);
    }

    private async verifyCleanup(): Promise<void> {
        console.log('🔍 Vérification du nettoyage...');

        // Compter les commandes restantes
        const commandesRestantes = await prisma.commande.count();
        console.log(`   Commandes restantes: ${commandesRestantes}`);

        if (commandesRestantes > 0) {
            throw new Error('Certaines commandes n\'ont pas pu être supprimées');
        }

        // Vérifier qu'il n'y a plus d'enregistrements orphelins
        const tablesWithCommandeFK = [
            'factures', 'devis', 'rapports_enlevement',
            'rapports_livraison', 'historique'
        ];

        for (const tableName of tablesWithCommandeFK) {
            try {
                const count = await this.countRelatedRecords(tableName);
                if (count > 0) {
                    console.warn(`⚠️ ${tableName}: ${count} enregistrements orphelins détectés`);
                }
            } catch (error) {
                // Table n'existe pas, c'est OK
            }
        }

        console.log('✅ Nettoyage vérifié');
    }

    // Méthode alternative : désactiver temporairement les contraintes FK
    async disableForeignKeyChecks(): Promise<void> {
        console.log('⚠️ Désactivation temporaire des contraintes FK...');

        try {
            // PostgreSQL ne permet pas de désactiver globalement les FK
            // On doit les supprimer temporairement

            await prisma.$executeRaw`SET session_replication_role = replica;`;
            console.log('✅ Contraintes FK désactivées temporairement');

        } catch (error) {
            console.error('❌ Impossible de désactiver les FK:', error);
            throw error;
        }
    }

    async enableForeignKeyChecks(): Promise<void> {
        console.log('🔒 Réactivation des contraintes FK...');

        try {
            await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;
            console.log('✅ Contraintes FK réactivées');

        } catch (error) {
            console.error('❌ Impossible de réactiver les FK:', error);
        }
    }

    // Méthode pour migration sans suppression (UPDATE au lieu de DELETE)
    async migrationWithoutDeletion(): Promise<void> {
        console.log('🔄 Migration sans suppression (mode UPDATE)...');

        // Au lieu de supprimer, on marque les commandes existantes comme archivées
        const existingCommandes = await prisma.commande.findMany({
            select: { id: true, numeroCommande: true }
        });

        for (const commande of existingCommandes) {
            await prisma.commande.update({
                where: { id: commande.id },
                data: {
                    numeroCommande: `ARCHIVED_${commande.numeroCommande}`,
                    statutCommande: 'ARCHIVEE'
                }
            });
        }

        console.log(`✅ ${existingCommandes.length} commandes archivées`);
    }
}

// Script de diagnostic des contraintes FK
export class ForeignKeyDiagnostic {

    async analyzeSchema(): Promise<void> {
        console.log('📋 Analyse du schéma des contraintes FK...\n');

        try {
            // Lister toutes les contraintes FK
            const constraints = await prisma.$queryRaw`
        SELECT 
          tc.table_name,
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name;
      `;

            console.log('🔗 Contraintes de clés étrangères détectées:');

            // @ts-ignore
            constraints.forEach((constraint: any) => {
                console.log(`   ${constraint.table_name}.${constraint.column_name} → ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
            });

            // Identifier celles qui référencent la table commandes
            // @ts-ignore
            const commandeConstraints = constraints.filter((c: any) =>
                c.foreign_table_name === 'commandes'
            );

            if (commandeConstraints.length > 0) {
                console.log('\n⚠️ Tables qui référencent "commandes":');
                commandeConstraints.forEach((constraint: any) => {
                    console.log(`   ${constraint.table_name}.${constraint.column_name}`);
                });
            }

        } catch (error) {
            console.error('❌ Erreur analyse schéma:', error);
        }
    }
}

// Script principal
async function main() {
    const fixer = new ForeignKeyConstraintsFixer();
    const diagnostic = new ForeignKeyDiagnostic();

    try {
        // 1. Diagnostic du schéma
        await diagnostic.analyzeSchema();

        // 2. Correction des contraintes
        await fixer.analyzeAndFixConstraints();

        console.log('\n🎯 Contraintes FK résolues ! Vous pouvez maintenant relancer la migration.');

    } catch (error) {
        console.error('\n❌ Échec de la correction FK:', error);

        console.log('\n💡 Solutions alternatives:');
        console.log('   1. Utiliser la migration sans suppression');
        console.log('   2. Réinitialiser complètement la base');
        console.log('   3. Migrer avec archivage des données existantes');

    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}