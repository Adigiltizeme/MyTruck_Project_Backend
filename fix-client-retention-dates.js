const { PrismaClient } = require('@prisma/client');

async function fixClientRetentionDates() {
  const prisma = new PrismaClient();
  
  try {
    // Date de rétention dans 2 ans (défaut standard pour RGPD)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    
    console.log('🔧 Correction des dates de rétention clients...');
    console.log('📅 Nouvelle date de rétention:', futureDate.toISOString());
    
    // Compter les clients avec des dates NULL ou expirées
    const invalidClients = await prisma.client.count({
      where: {
        OR: [
          { dataRetentionUntil: null },
          { dataRetentionUntil: { lt: new Date() } }
        ]
      }
    });
    
    console.log(`🗓️ Clients avec dates NULL/expirées: ${invalidClients}`);
    
    // Mettre à jour tous les clients avec dates NULL ou expirées
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
    
    console.log(`✅ ${result.count} clients mis à jour`);
    
    // Vérification
    const validClients = await prisma.client.count({
      where: {
        dataRetentionUntil: { gte: new Date() },
        deletionRequested: false
      }
    });
    
    console.log(`🎯 Clients maintenant valides: ${validClients}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixClientRetentionDates();