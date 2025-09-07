import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdminAccounts() {
  try {
    console.log('🔧 Création des comptes administrateurs...');

    // Hash des mots de passe
    const adamaPasswordHash = await bcrypt.hash('Adama123', 10);
    const mytruckPasswordHash = await bcrypt.hash('Mytruck123', 10);

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

    // Vérifier si admin@test.com existe et le réactiver si nécessaire
    try {
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
      console.log('✅ Compte test admin@test.com réactivé');
    } catch (error) {
      console.log('ℹ️  Compte admin@test.com déjà configuré');
    }

    console.log('✅ Comptes administrateurs créés avec succès:');
    console.log(`   - ${adamaUser.email} (${adamaUser.role})`);
    console.log(`   - ${mytruckUser.email} (${mytruckUser.role})`);
    console.log(`   - admin@test.com (ADMIN)`);

    console.log('\n🔐 Informations de connexion:');
    console.log('   Adama: adama.digiltizeme@gmail.com / Adama123');
    console.log('   Direction: mytruck.transport@gmail.com / Mytruck123'); 
    console.log('   Test: admin@test.com / admin123');

  } catch (error) {
    console.error('❌ Erreur lors de la création des comptes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
createAdminAccounts();