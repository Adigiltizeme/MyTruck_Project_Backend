import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMyTruckToAdmin() {
  try {
    console.log('🔧 Mise à jour du rôle direction My Truck vers ADMIN...');

    // Mettre à jour le compte Direction My Truck vers ADMIN
    const mytruckUser = await prisma.user.update({
      where: { email: 'mytruck.transport@gmail.com' },
      data: {
        role: 'ADMIN',
      },
    });

    console.log('✅ Compte direction My Truck mis à jour avec succès:');
    console.log(`   - ${mytruckUser.email} (${mytruckUser.role}) - Accès complet admin`);

    console.log('\n🔐 Comptes administrateurs avec accès complet:');
    console.log('   - adama.digiltizeme@gmail.com (ADMIN)');
    console.log('   - mytruck.transport@gmail.com (ADMIN) ← Mis à jour');
    console.log('   - admin@test.com (ADMIN)');

  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
updateMyTruckToAdmin();