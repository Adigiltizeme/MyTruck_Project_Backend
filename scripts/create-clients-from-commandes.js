/**
 * Script pour créer les clients manquants à partir des commandes existantes
 * Résout le problème : clients existent dans commandes mais pas dans table clients
 */
const { PrismaClient } = require('@prisma/client');

async function createClientsFromCommandes() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 [PRODUCTION] Création des clients à partir des commandes...\n');
    
    // ========== 1. ANALYSE DES COMMANDES ==========
    console.log('📋 === ANALYSE DES COMMANDES ===');
    
    const totalCommandes = await prisma.commande.count();
    console.log(`📊 Total commandes: ${totalCommandes}`);
    
    // Récupérer toutes les commandes avec les données clients
    const commandes = await prisma.commande.findMany({
      select: {
        id: true,
        numeroCommande: true,
        clientId: true,
        magasinId: true,
        dateCommande: true,
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            telephone: true,
            adresseLigne1: true,
            ville: true,
            typeAdresse: true
          }
        }
      }
    });
    
    console.log(`📋 Commandes récupérées: ${commandes.length}`);
    
    // Identifier les clientIds uniques
    const uniqueClientIds = [...new Set(commandes.map(c => c.clientId))];
    console.log(`👥 ClientIds uniques dans les commandes: ${uniqueClientIds.length}`);
    
    // ========== 2. VÉRIFIER CLIENTS EXISTANTS ==========
    console.log('\\n👤 === VÉRIFICATION CLIENTS EXISTANTS ===');
    
    const existingClients = await prisma.client.findMany({
      where: {
        id: { in: uniqueClientIds }
      },
      select: { id: true, nom: true, prenom: true }
    });
    
    console.log(`✅ Clients déjà existants dans table: ${existingClients.length}`);
    existingClients.forEach(c => {
      console.log(`  - ${c.id.substring(0, 8)}... (${c.prenom} ${c.nom})`);
    });
    
    const existingClientIds = existingClients.map(c => c.id);
    const missingClientIds = uniqueClientIds.filter(id => !existingClientIds.includes(id));
    
    console.log(`❌ Clients manquants: ${missingClientIds.length}`);
    
    if (missingClientIds.length === 0) {
      console.log('\\n✅ Tous les clients existent déjà dans la table!');
      
      // Vérifier les dates de rétention
      const clientsWithNullDates = await prisma.client.count({
        where: { dataRetentionUntil: null }
      });
      
      if (clientsWithNullDates > 0) {
        console.log(`\\n⚠️  ${clientsWithNullDates} clients ont des dates de rétention NULL`);
        console.log('🔧 Correction des dates...');
        
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 2);
        
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
        
        console.log(`✅ ${result.count} clients avec dates corrigées`);
      }
      
      return;
    }
    
    // ========== 3. CRÉER LES CLIENTS MANQUANTS ==========
    console.log('\\n🔧 === CRÉATION DES CLIENTS MANQUANTS ===');
    
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    
    let createdCount = 0;
    let errorCount = 0;
    
    for (const clientId of missingClientIds) {
      // Trouver une commande avec ce clientId pour récupérer les données
      const commandeWithClient = commandes.find(c => c.clientId === clientId);
      
      if (!commandeWithClient) {
        console.log(`❌ Aucune commande trouvée pour clientId: ${clientId}`);
        errorCount++;
        continue;
      }
      
      try {
        // Extraire les données client de la première commande
        const firstCommandeForClient = commandes
          .filter(c => c.clientId === clientId)
          .sort((a, b) => new Date(a.dateCommande) - new Date(b.dateCommande))[0];
        
        // Récupérer plus d'infos depuis la commande si possible
        const fullCommande = await prisma.commande.findUnique({
          where: { id: firstCommandeForClient.id },
          include: { client: true }
        });
        
        const clientData = fullCommande?.client;
        
        if (!clientData) {
          console.log(`❌ Pas de données client pour ${clientId}`);
          errorCount++;
          continue;
        }
        
        // Créer le client avec les données extraites
        await prisma.client.create({
          data: {
            id: clientId, // Utiliser le même ID que dans les commandes
            nom: clientData.nom || 'Nom manquant',
            prenom: clientData.prenom || null,
            telephone: clientData.telephone || null,
            adresseLigne1: clientData.adresseLigne1 || null,
            ville: clientData.ville || null,
            typeAdresse: clientData.typeAdresse || 'Domicile',
            dataRetentionUntil: futureDate,
            deletionRequested: false,
            createdAt: firstCommandeForClient.dateCommande,
            updatedAt: new Date()
          }
        });
        
        console.log(`✅ Client créé: ${clientData.prenom} ${clientData.nom} (${clientId.substring(0, 8)}...)`);
        createdCount++;
        
      } catch (error) {
        console.error(`❌ Erreur création client ${clientId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`\\n📊 Résultats création:`);
    console.log(`  - ✅ Clients créés: ${createdCount}`);
    console.log(`  - ❌ Erreurs: ${errorCount}`);
    
    // ========== 4. VÉRIFICATION FINALE ==========
    console.log('\\n🧪 === VÉRIFICATION FINALE ===');
    
    const finalClientCount = await prisma.client.count({
      where: {
        deletionRequested: false,
        dataRetentionUntil: { gte: new Date() }
      }
    });
    
    console.log(`👥 Total clients disponibles maintenant: ${finalClientCount}`);
    
    // Test par magasin
    const magasins = await prisma.magasin.findMany({
      select: { id: true, nom: true },
      take: 3
    });
    
    for (const magasin of magasins) {
      const clientsForMagasin = await prisma.client.count({
        where: {
          deletionRequested: false,
          dataRetentionUntil: { gte: new Date() },
          commandes: {
            some: { magasinId: magasin.id }
          }
        }
      });
      
      console.log(`🏪 Clients pour ${magasin.nom}: ${clientsForMagasin}`);
    }
    
    console.log('\\n🎉 Création des clients terminée avec succès!');
    console.log('🔄 Les clients devraient maintenant être visibles dans l\'interface.');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création des clients:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
console.log('🚀 Démarrage de la création des clients à partir des commandes...');
createClientsFromCommandes();