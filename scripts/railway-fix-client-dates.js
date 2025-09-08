/**
 * Script pour corriger les dates de rétention des clients directement sur Railway
 * Utilise la DATABASE_URL de production Railway
 */
const { PrismaClient } = require('@prisma/client');

async function fixRailwayClientDates() {
  // Prisma utilisera automatiquement la DATABASE_URL de Railway
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 [RAILWAY] Correction des dates de rétention clients...');
    
    // Date de rétention dans 2 ans (conforme RGPD)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    
    console.log('📅 Nouvelle date de rétention:', futureDate.toISOString());
    
    // Statistiques avant correction
    console.log('📊 Analyse de l\'état actuel...');
    
    const [totalClients, validClients, nullClients, expiredClients] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { dataRetentionUntil: { gte: new Date() } } }),
      prisma.client.count({ where: { dataRetentionUntil: null } }),
      prisma.client.count({ where: { dataRetentionUntil: { lt: new Date() } } })
    ]);
    
    console.log(`📋 État actuel:`);
    console.log(`  - Total clients: ${totalClients}`);
    console.log(`  - Dates valides: ${validClients}`);
    console.log(`  - Dates NULL: ${nullClients}`);
    console.log(`  - Dates expirées: ${expiredClients}`);
    
    const clientsToFix = nullClients + expiredClients;
    
    if (clientsToFix === 0) {
      console.log('✅ Tous les clients ont déjà des dates valides!');
      return;
    }
    
    console.log(`🔧 Correction de ${clientsToFix} clients...`);
    
    // Correction des dates NULL et expirées
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
    const [validAfter, eligibleClients] = await Promise.all([
      prisma.client.count({ where: { dataRetentionUntil: { gte: new Date() } } }),
      prisma.client.count({ 
        where: { 
          dataRetentionUntil: { gte: new Date() },
          deletionRequested: false 
        } 
      })
    ]);
    
    console.log(`📈 Résultats:`);
    console.log(`  - Clients avec dates valides: ${validAfter}`);
    console.log(`  - Clients éligibles (non supprimés): ${eligibleClients}`);
    
    // Test de requête des clients par magasin
    console.log('\\n🧪 Test de récupération des clients...');
    
    const sampleMagasin = await prisma.magasin.findFirst({
      select: { id: true, nom: true }
    });
    
    if (sampleMagasin) {
      const clientsForMagasin = await prisma.client.findMany({
        where: {
          deletionRequested: false,
          dataRetentionUntil: { gte: new Date() },
          commandes: {
            some: { magasinId: sampleMagasin.id }
          }
        },
        take: 5,
        select: { 
          nom: true, 
          prenom: true,
          _count: { select: { commandes: true } } 
        }
      });
      
      console.log(`🏪 Clients pour ${sampleMagasin.nom}: ${clientsForMagasin.length}`);
      clientsForMagasin.forEach(c => {
        console.log(`  - ${c.prenom} ${c.nom} (${c._count.commandes} commandes)`);
      });
    }
    
    console.log('\\n🎉 Correction terminée avec succès sur Railway!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction Railway:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
console.log('🚂 Démarrage du script Railway...');
fixRailwayClientDates();