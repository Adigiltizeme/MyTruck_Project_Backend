import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function debugLogin() {
  try {
    const email = 'adama.digiltizeme@gmail.com';
    const password = 'Adama123';
    
    console.log('🔍 Debug du processus de login...');
    console.log(`Email testé: ${email}`);
    console.log(`Password testé: ${password}\n`);

    // Étape 1: Chercher dans les magasins
    console.log('1️⃣ Recherche dans les magasins...');
    const magasin = await prisma.magasin.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        nom: true,
        hasAccount: true,
        accountStatus: true,
      }
    });
    
    if (magasin) {
      console.log('   ✅ Trouvé dans magasins:', magasin);
      if (magasin.password) {
        const isValid = await bcrypt.compare(password, magasin.password);
        console.log('   🔐 Password valide:', isValid);
        console.log('   🏪 Has account:', magasin.hasAccount);
        console.log('   📊 Account status:', magasin.accountStatus);
      }
    } else {
      console.log('   ❌ Non trouvé dans magasins');
    }

    // Étape 2: Chercher dans les chauffeurs
    console.log('\n2️⃣ Recherche dans les chauffeurs...');
    const chauffeur = await prisma.chauffeur.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        nom: true,
        prenom: true,
        hasAccount: true,
        accountStatus: true,
      }
    });
    
    if (chauffeur) {
      console.log('   ✅ Trouvé dans chauffeurs:', chauffeur);
      if (chauffeur.password) {
        const isValid = await bcrypt.compare(password, chauffeur.password);
        console.log('   🔐 Password valide:', isValid);
      }
    } else {
      console.log('   ❌ Non trouvé dans chauffeurs');
    }

    // Étape 3: Chercher dans les utilisateurs système
    console.log('\n3️⃣ Recherche dans les utilisateurs système...');
    const user = await prisma.user.findUnique({
      where: { email },
      include: { magasin: true }
    });
    
    if (user) {
      console.log('   ✅ Trouvé dans utilisateurs:');
      console.log('      - ID:', user.id);
      console.log('      - Email:', user.email);
      console.log('      - Nom:', user.nom, user.prenom);
      console.log('      - Rôle:', user.role);
      console.log('      - Statut:', user.status);
      console.log('      - Password hash présent:', !!user.password);
      
      if (user.password) {
        const isValid = await bcrypt.compare(password, user.password);
        console.log('      - Password valide:', isValid);
        
        if (isValid) {
          console.log('\n🎉 AUTHENTIFICATION RÉUSSIE!');
          console.log('   Données utilisateur retournées:');
          const { password: _, ...result } = user;
          console.log('   ', JSON.stringify({
            ...result,
            entityType: 'user'
          }, null, 2));
        }
      }
    } else {
      console.log('   ❌ Non trouvé dans utilisateurs système');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugLogin();