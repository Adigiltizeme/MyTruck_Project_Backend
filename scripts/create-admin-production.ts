import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Configuration pour production
const DATABASE_URL = "postgresql://postgres:XmgUVedaDmUYCAHokafWVipNvYeIzbqG@postgres.railway.internal:5432/railway";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL
    }
  }
});

async function createAdminAccountsProduction() {
  try {
    console.log('🔧 Création des comptes administrateurs en PRODUCTION...');
    console.log('📍 Base de données:', DATABASE_URL.split('@')[1]);

    // Hash des mots de passe
    const adamaPasswordHash = await bcrypt.hash('Adama123', 10);
    const mytruckPasswordHash = await bcrypt.hash('Mytruck123', 10);

    // Test de connexion
    await prisma.user.findMany({ take: 1 });
    console.log('✅ Connexion à la base de production réussie');

    // Créer ou mettre à jour le compte Adama (Admin principal)
    const adamaUser = await prisma.user.upsert({
      where: { email: 'adama.digiltizeme@gmail.com' },
      update: {
        password: adamaPasswordHash,
        role: 'ADMIN',
        status: 'Actif',
        nom: 'Digiltizeme',
        prenom: 'Adama',
      },
      create: {
        email: 'adama.digiltizeme@gmail.com',
        password: adamaPasswordHash,
        role: 'ADMIN',
        status: 'Actif',
        nom: 'Digiltizeme',
        prenom: 'Adama',
      },
    });

    // Créer ou mettre à jour le compte Direction My Truck
    const mytruckUser = await prisma.user.upsert({
      where: { email: 'mytruck.transport@gmail.com' },
      update: {
        password: mytruckPasswordHash,
        role: 'DIRECTION',
        status: 'Actif',
        nom: 'My Truck',
        prenom: 'Direction',
      },
      create: {
        email: 'mytruck.transport@gmail.com',
        password: mytruckPasswordHash,
        role: 'DIRECTION',
        status: 'Actif',
        nom: 'My Truck',
        prenom: 'Direction',
      },
    });

    // Créer compte test
    const testAdmin = await prisma.user.upsert({
      where: { email: 'admin@test.com' },
      update: {
        status: 'Actif',
        role: 'ADMIN',
      },
      create: {
        email: 'admin@test.com',
        password: await bcrypt.hash('admin123', 10),
        role: 'ADMIN',
        status: 'Actif',
        nom: 'Test',
        prenom: 'Admin',
      },
    });

    console.log('✅ Comptes administrateurs créés en PRODUCTION:');
    console.log(`   - ${adamaUser.email} (${adamaUser.role})`);
    console.log(`   - ${mytruckUser.email} (${mytruckUser.role})`);
    console.log(`   - ${testAdmin.email} (${testAdmin.role})`);

    console.log('\n🔐 Identifiants de connexion PRODUCTION:');
    console.log('   Adama: adama.digiltizeme@gmail.com / Adama123');
    console.log('   Direction: mytruck.transport@gmail.com / Mytruck123'); 
    console.log('   Test: admin@test.com / admin123');

    // Vérification des comptes créés
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: ['adama.digiltizeme@gmail.com', 'mytruck.transport@gmail.com', 'admin@test.com']
        }
      },
      select: { id: true, email: true, role: true, status: true }
    });
    
    console.log('\n📋 Vérification des comptes:');
    users.forEach(user => {
      console.log(`   ✓ ${user.email} - ${user.role} - ${user.status}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la création des comptes:', error);
    console.error('Détails:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
createAdminAccountsProduction();