const { PrismaClient } = require('@prisma/client');

async function checkMagasinAccounts() {
  const prisma = new PrismaClient();
  
  try {
    const magasins = await prisma.magasin.findMany({
      where: {
        hasAccount: true
      },
      select: {
        id: true,
        email: true,
        nom: true,
        hasAccount: true,
        accountStatus: true,
        password: true
      },
      take: 5
    });
    
    console.log('Magasins avec comptes actifs:');
    magasins.forEach(m => {
      console.log(`- ${m.nom}: ${m.email} (${m.accountStatus}) - Password: ${m.password ? 'SET' : 'NOT SET'}`);
    });
    
    // Essayons aussi de voir s'il y a des commandes associées
    if (magasins.length > 0) {
      const magasinId = magasins[0].id;
      const commandes = await prisma.commande.findMany({
        where: { magasinId },
        select: {
          id: true,
          numeroCommande: true,
          clientId: true
        },
        take: 3
      });
      
      console.log(`\nCommandes pour magasin ${magasins[0].nom}:`);
      commandes.forEach(c => {
        console.log(`- ${c.numeroCommande} (clientId: ${c.clientId})`);
      });
    }
    
  } catch (error) {
    console.error('Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMagasinAccounts();