const { PrismaClient } = require('@prisma/client');

async function debugClientFiltering() {
  const prisma = new PrismaClient();
  
  try {
    const magasinId = '0d678a57-642b-41fb-a32e-38331b64c553';
    
    console.log('🔍 Débogage filtrage clients pour magasin:', magasinId);
    
    // 1. Vérifier les commandes pour ce magasin
    const commandes = await prisma.commande.findMany({
      where: { magasinId },
      select: {
        id: true,
        numeroCommande: true,
        clientId: true,
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true
          }
        }
      },
      take: 5
    });
    
    console.log(`\n📦 Commandes pour ce magasin (${commandes.length}):`,);
    commandes.forEach(c => {
      console.log(`- ${c.numeroCommande}: Client ${c.client?.nom || 'N/A'} (${c.clientId})`);
    });
    
    // 2. Utiliser la même requête que le service
    const where = {
      deletionRequested: false,
      dataRetentionUntil: { gte: new Date() },
      commandes: {
        some: {
          magasinId: magasinId
        }
      }
    };
    
    console.log('\n🎯 Requête Prisma utilisée:', JSON.stringify(where, null, 2));
    
    const clients = await prisma.client.findMany({
      where,
      take: 10,
      include: {
        _count: {
          select: {
            commandes: true,
          },
        },
      },
    });
    
    console.log(`\n👥 Clients trouvés avec cette requête (${clients.length}):`);
    clients.forEach(c => {
      console.log(`- ${c.nom} ${c.prenom || ''} (${c._count.commandes} commandes)`);
    });
    
    // 3. Vérifier si les clients ont bien dataRetentionUntil >= now
    const allClients = await prisma.client.findMany({
      where: {
        commandes: {
          some: { magasinId }
        }
      },
      select: {
        id: true,
        nom: true,
        dataRetentionUntil: true,
        deletionRequested: true
      }
    });
    
    console.log(`\n🗓️ Tous les clients liés aux commandes du magasin (${allClients.length}):`);
    const now = new Date();
    allClients.forEach(c => {
      const retentionOk = c.dataRetentionUntil >= now;
      const notDeleted = !c.deletionRequested;
      console.log(`- ${c.nom}: retention=${retentionOk}, deletion=${c.deletionRequested}, eligible=${retentionOk && notDeleted}`);
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugClientFiltering();