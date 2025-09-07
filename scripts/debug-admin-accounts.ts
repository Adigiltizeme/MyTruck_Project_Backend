import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function debugAdminAccounts() {
  try {
    console.log('🔍 Diagnostic des comptes administrateurs...\n');

    // Vérifier tous les utilisateurs avec rôle ADMIN
    const adminUsers = await prisma.user.findMany({
      where: {
        role: 'ADMIN'
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        status: true,
        createdAt: true,
        password: true, // Pour vérifier si le hash existe
      }
    });

    console.log('📋 Comptes administrateurs trouvés:');
    for (const user of adminUsers) {
      console.log(`   ✅ ${user.email}`);
      console.log(`      - ID: ${user.id}`);
      console.log(`      - Nom: ${user.nom} ${user.prenom || ''}`);
      console.log(`      - Rôle: ${user.role}`);
      console.log(`      - Statut: ${user.status}`);
      console.log(`      - Créé: ${user.createdAt.toISOString()}`);
      console.log(`      - Hash mot de passe: ${user.password ? 'Présent' : 'MANQUANT!'}`);
      console.log('');
    }

    // Test de hash pour le mot de passe d'Adama
    console.log('🔐 Test de validation des mots de passe:');
    
    const adamaUser = adminUsers.find(u => u.email === 'adama.digiltizeme@gmail.com');
    if (adamaUser && adamaUser.password) {
      const isValidAdama = await bcrypt.compare('Adama123', adamaUser.password);
      console.log(`   - adama.digiltizeme@gmail.com + "Adama123": ${isValidAdama ? '✅ VALIDE' : '❌ INVALIDE'}`);
    }

    const mytruckUser = adminUsers.find(u => u.email === 'mytruck.transport@gmail.com');
    if (mytruckUser && mytruckUser.password) {
      const isValidMytruck = await bcrypt.compare('Mytruck123', mytruckUser.password);
      console.log(`   - mytruck.transport@gmail.com + "Mytruck123": ${isValidMytruck ? '✅ VALIDE' : '❌ INVALIDE'}`);
    }

    const testUser = adminUsers.find(u => u.email === 'admin@test.com');
    if (testUser && testUser.password) {
      const isValidTest = await bcrypt.compare('admin123', testUser.password);
      console.log(`   - admin@test.com + "admin123": ${isValidTest ? '✅ VALIDE' : '❌ INVALIDE'}`);
    }

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le diagnostic
debugAdminAccounts();