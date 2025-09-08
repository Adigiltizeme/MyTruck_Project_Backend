/**
 * Script complet pour corriger:
 * 1. Les liens User-Magasin manquants
 * 2. Les dates de rétention clients NULL
 */
const { PrismaClient } = require('@prisma/client');

async function fixUsersAndClients() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 [PRODUCTION] Diagnostic et correction complète...\n');
    
    // ========== 1. ANALYSE DES UTILISATEURS ==========
    console.log('👥 === ANALYSE DES UTILISATEURS ===');
    
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        magasinId: true,
        magasin: { select: { nom: true } }
      }
    });
    
    console.log(`📊 Total utilisateurs: ${allUsers.length}`);
    
    const usersWithoutMagasin = allUsers.filter(u => u.role === 'MAGASIN' && !u.magasinId);
    const usersWithMagasin = allUsers.filter(u => u.role === 'MAGASIN' && u.magasinId);
    
    console.log(`🏪 Utilisateurs MAGASIN avec magasinId: ${usersWithMagasin.length}`);
    console.log(`❌ Utilisateurs MAGASIN SANS magasinId: ${usersWithoutMagasin.length}`);
    
    if (usersWithoutMagasin.length > 0) {
      console.log('\\n🔍 Utilisateurs problématiques:');
      usersWithoutMagasin.forEach(u => {
        console.log(`  - ${u.email} (${u.prenom} ${u.nom})`);
      });
    }
    
    // ========== 2. ANALYSE DES MAGASINS ==========
    console.log('\\n🏪 === ANALYSE DES MAGASINS ===');
    
    const allMagasins = await prisma.magasin.findMany({
      select: { 
        id: true, 
        nom: true, 
        email: true,
        _count: { select: { users: true, commandes: true } }
      }
    });
    
    console.log(`📊 Total magasins: ${allMagasins.length}`);
    allMagasins.forEach(m => {
      console.log(`  - ${m.nom} (${m.email}) - ${m._count.users} users, ${m._count.commandes} commandes`);
    });
    
    // ========== 3. CORRECTION DES LIENS USER-MAGASIN ==========
    console.log('\\n🔧 === CORRECTION DES LIENS USER-MAGASIN ===');
    
    let fixedUsers = 0;
    
    for (const user of usersWithoutMagasin) {
      let targetMagasinId = null;
      
      // Logique de mapping basée sur l'email
      if (user.email.includes('truffaut.com')) {
        if (user.email.includes('boulogne')) {
          // Chercher magasin Boulogne
          const boulogne = allMagasins.find(m => m.nom.toLowerCase().includes('boulogne'));
          targetMagasinId = boulogne?.id;
        } else if (user.email.includes('ivry')) {
          // Chercher magasin Ivry
          const ivry = allMagasins.find(m => m.nom.toLowerCase().includes('ivry'));
          targetMagasinId = ivry?.id;
        } else {
          // Par défaut, assigner au premier magasin Truffaut
          const truffaut = allMagasins.find(m => m.nom.toLowerCase().includes('truffaut'));
          targetMagasinId = truffaut?.id;
        }
      } else {
        // Pour les autres domaines, assigner au premier magasin disponible
        targetMagasinId = allMagasins[0]?.id;
      }
      
      if (targetMagasinId) {
        console.log(`🔗 Liaison ${user.email} -> ${allMagasins.find(m => m.id === targetMagasinId)?.nom}`);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { magasinId: targetMagasinId }
        });
        
        fixedUsers++;
      } else {
        console.log(`❌ Impossible de trouver un magasin pour ${user.email}`);
      }
    }
    
    console.log(`✅ ${fixedUsers} utilisateurs corrigés`);
    
    // ========== 4. ANALYSE DES CLIENTS ==========
    console.log('\\n👤 === ANALYSE DES CLIENTS ===');
    
    const [totalClients, validClients, nullClients, expiredClients] = await Promise.all([
      prisma.client.count(),
      prisma.client.count({ where: { dataRetentionUntil: { gte: new Date() } } }),
      prisma.client.count({ where: { dataRetentionUntil: null } }),
      prisma.client.count({ where: { dataRetentionUntil: { lt: new Date() } } })
    ]);
    
    console.log(`📊 État clients:`);
    console.log(`  - Total: ${totalClients}`);
    console.log(`  - Dates valides: ${validClients}`);
    console.log(`  - Dates NULL: ${nullClients}`);
    console.log(`  - Dates expirées: ${expiredClients}`);
    
    // ========== 5. CORRECTION DES DATES CLIENTS ==========
    const clientsToFix = nullClients + expiredClients;
    
    if (clientsToFix > 0) {
      console.log('\\n🔧 === CORRECTION DES DATES CLIENTS ===');
      
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 2);
      
      console.log(`📅 Nouvelle date de rétention: ${futureDate.toISOString()}`);
      console.log(`🔧 Correction de ${clientsToFix} clients...`);
      
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
    } else {
      console.log('\\n✅ Toutes les dates clients sont valides');
    }
    
    // ========== 6. VÉRIFICATION FINALE ==========
    console.log('\\n🧪 === VÉRIFICATION FINALE ===');
    
    // Test de récupération des clients par magasin
    const correctedUsers = await prisma.user.findMany({
      where: { role: 'MAGASIN', magasinId: { not: null } },
      select: { email: true, magasin: { select: { nom: true } } }
    });
    
    console.log(`🔗 Utilisateurs maintenant liés: ${correctedUsers.length}`);
    correctedUsers.forEach(u => {
      console.log(`  - ${u.email} -> ${u.magasin?.nom}`);
    });
    
    // Test de requête clients par magasin
    for (const magasin of allMagasins.slice(0, 2)) {
      const clientsCount = await prisma.client.count({
        where: {
          deletionRequested: false,
          dataRetentionUntil: { gte: new Date() },
          commandes: {
            some: { magasinId: magasin.id }
          }
        }
      });
      
      console.log(`📋 Clients éligibles pour ${magasin.nom}: ${clientsCount}`);
    }
    
    console.log('\\n🎉 Correction complète terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors de la correction:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
console.log('🚂 Démarrage du script de correction complète...');
fixUsersAndClients();