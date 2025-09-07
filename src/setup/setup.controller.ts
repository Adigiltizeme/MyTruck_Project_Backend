import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('setup')
export class SetupController {
  constructor(private prisma: PrismaService) {}

  @Post('admins')
  @HttpCode(HttpStatus.OK)
  async createAdminAccounts() {
    try {
      console.log('🔧 Création des comptes administrateurs...');

      // Hash des mots de passe
      const adamaPasswordHash = await bcrypt.hash('Adama123', 10);
      const mytruckPasswordHash = await bcrypt.hash('Mytruck123', 10);
      const testPasswordHash = await bcrypt.hash('admin123', 10);

      // Créer ou mettre à jour le compte Adama
      const adamaUser = await this.prisma.user.upsert({
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
      const mytruckUser = await this.prisma.user.upsert({
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

      // Créer ou mettre à jour le compte admin@test.com
      const testAdmin = await this.prisma.user.upsert({
        where: { email: 'admin@test.com' },
        update: {
          status: 'Actif',
          role: 'ADMIN',
          password: testPasswordHash,
        },
        create: {
          email: 'admin@test.com',
          password: testPasswordHash,
          role: 'ADMIN',
          status: 'Actif',
          nom: 'Test',
          prenom: 'Admin',
        },
      });

      return {
        success: true,
        message: 'Comptes administrateurs créés avec succès',
        accounts: [
          { email: adamaUser.email, role: adamaUser.role },
          { email: mytruckUser.email, role: mytruckUser.role },
          { email: testAdmin.email, role: testAdmin.role },
        ],
        credentials: [
          'adama.digiltizeme@gmail.com / Adama123',
          'mytruck.transport@gmail.com / Mytruck123',
          'admin@test.com / admin123'
        ]
      };

    } catch (error) {
      console.error('❌ Erreur:', error);
      return {
        success: false,
        message: 'Erreur lors de la création des comptes',
        error: error.message
      };
    }
  }
}