const { PrismaClient } = require('@prisma/client');

async function checkClientDates() {
  const prisma = new PrismaClient();
  
  try {
    const now = new Date();
    console.log('⏰ Date actuelle:', now.toISOString());
    
    // Prendre quelques clients pour examiner leurs dates
    const clients = await prisma.client.findMany({
      take: 10,
      select: {
        id: true,
        nom: true,
        dataRetentionUntil: true,
        deletionRequested: true,
        createdAt: true
      },
      orderBy: { nom: 'asc' }
    });
    
    console.log('\n📋 Échantillon de clients:');
    clients.forEach(c => {
      const retentionDate = c.dataRetentionUntil;
      const isValid = retentionDate >= now;
      console.log(`- ${c.nom}:`);
      console.log(`  • Rétention: ${retentionDate?.toISOString() || 'NULL'} (valide: ${isValid})`);
      console.log(`  • Suppression demandée: ${c.deletionRequested}`);
      console.log(`  • Créé: ${c.createdAt.toISOString()}`);
    });
    
    // Statistiques
    const stats = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { dataRetentionUntil: { gte: now } } }),
      prisma.client.count({ where: { dataRetentionUntil: { lt: now } } }),
      prisma.client.count({ where: { dataRetentionUntil: null } }),
      prisma.client.count({ where: { deletionRequested: true } })
    ]);
    
    console.log('\n📊 Statistiques clients:');
    console.log(`Total clients: ${stats[0]}`);
    console.log(`Dates valides: ${stats[1]}`);
    console.log(`Dates expirées: ${stats[2]}`);
    console.log(`Dates NULL: ${stats[3]}`);
    console.log(`Suppression demandée: ${stats[4]}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkClientDates();