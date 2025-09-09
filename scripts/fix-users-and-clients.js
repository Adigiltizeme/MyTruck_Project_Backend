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
    
    // 🎯 STRATÉGIE DE MAPPING INTELLIGENTE
    for (const user of usersWithoutMagasin) {
      let targetMagasinId = null;
      let mappingReason = '';
      
      console.log(`\\n🔍 Analyse de ${user.email} (${user.prenom} ${user.nom}):`);
      
      // === ÉTAPE 1: Mapping par domaine spécifique ===
      if (user.email.includes('truffaut.com')) {
        console.log('  📧 Domaine Truffaut détecté');
        
        if (user.email.includes('boulogne')) {
          const boulogne = allMagasins.find(m => m.nom.toLowerCase().includes('boulogne'));
          targetMagasinId = boulogne?.id;
          mappingReason = 'Email contient "boulogne"';
        } else if (user.email.includes('ivry')) {
          const ivry = allMagasins.find(m => m.nom.toLowerCase().includes('ivry'));
          targetMagasinId = ivry?.id;
          mappingReason = 'Email contient "ivry"';
        } else {
          // Par défaut pour Truffaut, prendre le premier magasin Truffaut
          const truffaut = allMagasins.find(m => m.nom.toLowerCase().includes('truffaut'));
          targetMagasinId = truffaut?.id;
          mappingReason = 'Domaine Truffaut - magasin par défaut';
        }
      }
      
      // === ÉTAPE 1B: Mapping MyTruck spécifique (avant ou après @) ===
      else if (user.email.toLowerCase().includes('mytruck')) {
        console.log('  🚛 MyTruck détecté dans l\'email');
        
        const emailLower = user.email.toLowerCase();
        const emailLocalPart = emailLower.split('@')[0]; // Partie avant @
        
        // Détecter les suffixes géographiques après "mytruck"
        if (emailLocalPart.includes('mytruckarc') || emailLower.includes('arceuil')) {
          const arceuil = allMagasins.find(m => 
            m.nom.toLowerCase().includes('arceuil') ||
            m.adresse?.toLowerCase().includes('arceuil')
          );
          targetMagasinId = arceuil?.id;
          mappingReason = 'MyTruck avec suffixe "arc" (Arceuil)';
        } else if (emailLocalPart.includes('mytruckivr') || emailLower.includes('ivry')) {
          const ivry = allMagasins.find(m => 
            m.nom.toLowerCase().includes('ivry') ||
            m.adresse?.toLowerCase().includes('ivry')
          );
          targetMagasinId = ivry?.id;
          mappingReason = 'MyTruck avec suffixe "ivr" (Ivry)';
        } else if (emailLocalPart.includes('mytruckbou') || emailLower.includes('boulogne')) {
          const boulogne = allMagasins.find(m => 
            m.nom.toLowerCase().includes('boulogne') ||
            m.adresse?.toLowerCase().includes('boulogne')
          );
          targetMagasinId = boulogne?.id;
          mappingReason = 'MyTruck avec suffixe "bou" (Boulogne)';
        } else if (emailLocalPart.includes('mytruckvit') || emailLower.includes('vitry')) {
          const vitry = allMagasins.find(m => 
            m.nom.toLowerCase().includes('vitry') ||
            m.adresse?.toLowerCase().includes('vitry')
          );
          targetMagasinId = vitry?.id;
          mappingReason = 'MyTruck avec suffixe "vit" (Vitry)';
        } 
        
        // Patterns MyTruck génériques
        else if (emailLower.includes('@mytruck.') || emailLower.endsWith('@mytruck.com') || emailLower.endsWith('@mytruck.fr')) {
          // C'est un email du domaine MyTruck officiel
          const mytruckMagasin = allMagasins.find(m => 
            m.nom.toLowerCase().includes('my truck') || 
            m.nom.toLowerCase().includes('mytruck') ||
            m.email?.toLowerCase().includes('mytruck')
          );
          targetMagasinId = mytruckMagasin?.id;
          mappingReason = 'Domaine MyTruck officiel (@mytruck.com/fr)';
        } else {
          // MyTruck en préfixe mais domaine externe (ex: mytruckarc@gmail.com)
          console.log('    🔍 MyTruck préfixe détecté, analyse du suffixe...');
          
          // Extraire le suffixe après "mytruck" 
          const mytruckIndex = emailLocalPart.indexOf('mytruck');
          const suffix = emailLocalPart.substring(mytruckIndex + 7); // "mytruck".length = 7
          
          console.log(`    📝 Suffixe analysé: "${suffix}"`);
          
          // Mapping des suffixes courts vers les magasins
          const suffixMagasinMap = {
            'arc': 'arceuil',
            'ivr': 'ivry', 
            'bou': 'boulogne',
            'vit': 'vitry',
            'cha': 'champs', // Champs-Elysées
            'mon': 'montrouge',
            'lev': 'levallois'
          };
          
          const targetCity = suffixMagasinMap[suffix] || suffix;
          
          const matchingMagasin = allMagasins.find(m => 
            m.nom.toLowerCase().includes(targetCity) ||
            m.adresse?.toLowerCase().includes(targetCity)
          );
          
          if (matchingMagasin) {
            targetMagasinId = matchingMagasin.id;
            mappingReason = `MyTruck préfixe avec suffixe "${suffix}" → ${targetCity}`;
          } else {
            // Fallback vers le magasin MyTruck principal
            const mytruckMagasin = allMagasins.find(m => 
              m.nom.toLowerCase().includes('my truck') || 
              m.email?.toLowerCase().includes('mytruck')
            );
            targetMagasinId = mytruckMagasin?.id;
            mappingReason = 'MyTruck préfixe - fallback magasin principal';
          }
        }
      }
      
      // === ÉTAPE 2: Mapping par nom/prénom si domaine non spécifique ===
      else if (user.nom || user.prenom) {
        console.log('  👤 Tentative mapping par nom/prénom');
        
        const fullName = `${user.prenom || ''} ${user.nom || ''}`.toLowerCase();
        
        // Chercher correspondance dans les noms de magasins
        const matchingMagasin = allMagasins.find(magasin => {
          const magasinName = magasin.nom.toLowerCase();
          const magasinWords = magasinName.split(' ');
          
          return magasinWords.some(word => 
            word.length > 2 && fullName.includes(word)
          );
        });
        
        if (matchingMagasin) {
          targetMagasinId = matchingMagasin.id;
          mappingReason = `Nom correspond à ${matchingMagasin.nom}`;
        }
      }
      
      // === ÉTAPE 3: Mapping par analyse de l'email (sous-domaines, préfixes) ===
      if (!targetMagasinId) {
        console.log('  🔍 Analyse avancée de l\\'email');
        
        const emailParts = user.email.split('@')[0].toLowerCase();
        
        // Chercher des mots-clés dans la partie locale de l'email
        const matchingMagasin = allMagasins.find(magasin => {
          const magasinWords = magasin.nom.toLowerCase().split(' ');
          return magasinWords.some(word => 
            word.length > 3 && emailParts.includes(word)
          );
        });
        
        if (matchingMagasin) {
          targetMagasinId = matchingMagasin.id;
          mappingReason = `Email contient "${matchingMagasin.nom}"`;
        }
      }
      
      // === ÉTAPE 4: Attribution intelligente par défaut ===
      if (!targetMagasinId) {
        console.log('  🤖 Attribution par défaut intelligente');
        
        // Stratégie: équilibrer la charge entre magasins
        const magasinStats = await Promise.all(
          allMagasins.map(async (m) => ({
            ...m,
            userCount: await prisma.user.count({ where: { magasinId: m.id } }),
            commandeCount: m._count.commandes
          }))
        );
        
        // Prioriser les magasins avec le moins d'utilisateurs mais avec de l'activité
        const optimalMagasin = magasinStats
          .filter(m => m.commandeCount > 0) // Magasins actifs
          .sort((a, b) => a.userCount - b.userCount)[0]; // Moins d'utilisateurs
        
        targetMagasinId = optimalMagasin?.id || allMagasins[0]?.id;
        mappingReason = `Attribution équilibrée (${optimalMagasin?.userCount || 0} users)`;
      }
      
      if (targetMagasinId) {
        const targetMagasin = allMagasins.find(m => m.id === targetMagasinId);
        console.log(`  ✅ DÉCISION: ${targetMagasin?.nom}`);
        console.log(`  📝 RAISON: ${mappingReason}`);
        console.log(`🔗 Liaison ${user.email} -> ${targetMagasin?.nom}`);
        
        await prisma.user.update({
          where: { id: user.id },
          data: { magasinId: targetMagasinId }
        });
        
        fixedUsers++;
      } else {
        console.log(`  ❌ ÉCHEC: Impossible de trouver un magasin approprié`);
        console.log(`❌ Utilisateur non traité: ${user.email}`);
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