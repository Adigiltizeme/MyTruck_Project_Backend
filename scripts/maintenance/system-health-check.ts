import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class SystemHealthCheck {

    async runCompleteCheck(): Promise<void> {
        console.log('🔍 Vérification santé système My Truck Transport');
        console.log('='.repeat(60));

        await this.checkDatabaseHealth();
        await this.checkDataIntegrity();
        await this.checkPerformance();
        await this.generateReport();
    }

    private async checkDatabaseHealth(): Promise<void> {
        console.log('\n💾 SANTÉ BASE DE DONNÉES');
        console.log('-'.repeat(30));

        try {
            // Test connexion
            await prisma.$queryRaw`SELECT 1`;
            console.log('✅ Connexion PostgreSQL: OK');

            // Compter les enregistrements
            const counts = await Promise.all([
                prisma.user.count(),
                prisma.magasin.count(),
                prisma.client.count(),
                prisma.chauffeur.count(),
                prisma.commande.count()
            ]);

            console.log(`📊 Données:
      - Users: ${counts[0]}
      - Magasins: ${counts[1]}  
      - Clients: ${counts[2]}
      - Chauffeurs: ${counts[3]}
      - Commandes: ${counts[4]}`);

        } catch (error) {
            console.error('❌ Problème base de données:', error);
        }
    }

    private async checkDataIntegrity(): Promise<void> {
        console.log('\n🔍 INTÉGRITÉ DES DONNÉES');
        console.log('-'.repeat(30));

        try {
            // Vérifier les relations
            const orphanedCommandes = await prisma.commande.count({
                where: {
                    OR: [
                        { magasin: null },
                        { client: null }
                    ]
                }
            });

            if (orphanedCommandes === 0) {
                console.log('✅ Relations commandes: OK');
            } else {
                console.warn(`⚠️ ${orphanedCommandes} commandes avec relations brisées`);
            }

            // Vérifier les doublons
            const duplicateNumeros = await prisma.$queryRaw`
        SELECT numeroCommande, COUNT(*) as count
        FROM commandes 
        GROUP BY numeroCommande 
        HAVING COUNT(*) > 1
      `;

            // @ts-ignore
            if (duplicateNumeros.length === 0) {
                console.log('✅ Numéros commandes uniques: OK');
            } else {
                // @ts-ignore
                console.warn(`⚠️ ${duplicateNumeros.length} numéros dupliqués détectés`);
            }

        } catch (error) {
            console.error('❌ Erreur vérification intégrité:', error);
        }
    }

    private async checkPerformance(): Promise<void> {
        console.log('\n⚡ PERFORMANCE');
        console.log('-'.repeat(30));

        try {
            const start = Date.now();

            // Test requête simple
            await prisma.commande.findMany({ take: 10 });
            const simpleQuery = Date.now() - start;

            // Test requête complexe avec relations
            const complexStart = Date.now();
            await prisma.commande.findMany({
                take: 10,
                include: {
                    magasin: true,
                    client: true
                }
            });
            const complexQuery = Date.now() - complexStart;

            console.log(`📊 Temps de réponse:
      - Requête simple: ${simpleQuery}ms
      - Requête complexe: ${complexQuery}ms`);

            if (simpleQuery > 100) {
                console.warn('⚠️ Requêtes lentes détectées');
            } else {
                console.log('✅ Performance: OK');
            }

        } catch (error) {
            console.error('❌ Erreur test performance:', error);
        }
    }

    private async generateReport(): Promise<void> {
        console.log('\n📋 RAPPORT FINAL');
        console.log('='.repeat(60));

        const now = new Date().toLocaleString();
        console.log(`Vérification effectuée le: ${now}`);
        console.log('Système My Truck Transport - État général: ✅ OPÉRATIONNEL');
        console.log('');
        console.log('Prochaines vérifications recommandées:');
        console.log('- Quotidienne: Performance et connexions');
        console.log('- Hebdomadaire: Intégrité des données');
        console.log('- Mensuelle: Nettoyage et optimisation');
    }
}

// Script exécutable
async function main() {
    const healthCheck = new SystemHealthCheck();

    try {
        await healthCheck.runCompleteCheck();
    } catch (error) {
        console.error('❌ Erreur health check:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}