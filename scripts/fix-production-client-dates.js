/**
 * Script pour corriger les dates de rétention des clients en production
 * À exécuter sur Railway ou avec la DATABASE_URL de production
 */
const { PrismaClient } = require('@prisma/client');

async function fixProductionClientDates() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔧 [PRODUCTION] Correction des dates de rétention clients...');
    
    // Date de rétention dans 2 ans (conforme RGPD)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    
    console.log('📅 Nouvelle date de rétention:', futureDate.toISOString());
    
    // Statistiques avant correction
    const [totalClients, validClients, nullClients] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { dataRetentionUntil: { gte: new Date() } } }),
      prisma.client.count({ where: { dataRetentionUntil: null } })
    ]);
    
    console.log('\n📊 État actuel:');
    console.log(`- Total clients: ${totalClients}`);
    console.log(`- Dates valides: ${validClients}`);
    console.log(`- Dates NULL: ${nullClients}`);
    
    if (nullClients === 0) {
      console.log('✅ Tous les clients ont déjà des dates valides!');
      return;
    }
    
    // Correction des dates NULL
    console.log(`\n🔧 Correction de ${nullClients} clients...`);
    
    const result = await prisma.client.updateMany({
      where: {
        OR: [
          { dataRetentionUntil: null },
          { dataRetentionUntil: { lt: new Date() } }
        ]
      },
      data: {
        dataRetentionUntil: futureDate
      }
    });
    
    console.log(`✅ ${result.count} clients corrigés`);
    
    // Vérification post-correction
    const validClientsAfter = await prisma.client.count({
      where: {
        dataRetentionUntil: { gte: new Date() },
        deletionRequested: false
      }
    });
    
    console.log(`🎯 Clients maintenant éligibles: ${validClientsAfter}`);
    
    // Test de requête similaire au service clients
    console.log('\n🧪 Test de la requête clients par magasin...');
    
    const magasinTest = await prisma.magasin.findFirst({
      where: { hasAccount: true },
      select: { id: true, nom: true }
    });
    
    if (magasinTest) {
      const clientsForMagasin = await prisma.client.findMany({
        where: {
          deletionRequested: false,
          dataRetentionUntil: { gte: new Date() },
          commandes: {
            some: { magasinId: magasinTest.id }
          }
        },
        take: 3,
        select: { nom: true, _count: { select: { commandes: true } } }
      });
      
      console.log(`📋 Clients trouvés pour ${magasinTest.nom}: ${clientsForMagasin.length}`);
      clientsForMagasin.forEach(c => {
        console.log(`  - ${c.nom} (${c._count.commandes} commandes)`);
      });
    }
    
    console.log('\n🎉 Correction terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
console.log('🚀 Démarrage du script de correction des dates clients...');
fixProductionClientDates();