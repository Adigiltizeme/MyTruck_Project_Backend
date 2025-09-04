import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto, UpdateProfileDto, UpdatePasswordDto } from './dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    // Chercher d'abord dans les magasins
    const magasin = await this.prisma.magasin.findFirst({
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

    if (magasin && magasin.password && magasin.hasAccount && magasin.accountStatus === 'active') {
      const isPasswordValid = await bcrypt.compare(password, magasin.password);
      if (isPasswordValid) {
        const { password: _, ...result } = magasin;
        return {
          ...result,
          role: UserRole.MAGASIN,
          entityType: 'magasin'
        };
      }
    }

    // Chercher dans les chauffeurs
    const chauffeur = await this.prisma.chauffeur.findFirst({
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

    if (chauffeur && chauffeur.password && chauffeur.hasAccount && chauffeur.accountStatus === 'active') {
      const isPasswordValid = await bcrypt.compare(password, chauffeur.password);
      if (isPasswordValid) {
        const { password: _, ...result } = chauffeur;
        return {
          ...result,
          role: UserRole.CHAUFFEUR,
          entityType: 'chauffeur'
        };
      }
    }

    // Chercher dans les utilisateurs système (admins, etc.)
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { magasin: true }
    });

    if (user && await bcrypt.compare(password, user.password)) {
      const { password: _, ...result } = user;
      return {
        ...result,
        entityType: 'user'
      };
    }

    throw new UnauthorizedException('Email ou mot de passe incorrect');
  }

  async login(loginDto: LoginDto) {
    const validatedUser = await this.validateUser(loginDto.email, loginDto.password);
    
    const payload = { 
      email: validatedUser.email, 
      sub: validatedUser.id,
      role: validatedUser.role,
      entityType: validatedUser.entityType
    };

    // Mettre à jour lastLoginAt
    if (validatedUser.entityType === 'magasin') {
      await this.prisma.magasin.update({
        where: { id: validatedUser.id },
        data: { lastLoginAt: new Date() }
      });
    } else if (validatedUser.entityType === 'chauffeur') {
      await this.prisma.chauffeur.update({
        where: { id: validatedUser.id },
        data: { lastLoginAt: new Date() }
      });
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: validatedUser.id,
        email: validatedUser.email,
        nom: validatedUser.nom,
        prenom: validatedUser.prenom || null,
        role: validatedUser.role,
        status: validatedUser.accountStatus || validatedUser.status,
        magasin: validatedUser.entityType === 'magasin' ? {
          id: validatedUser.id,
          nom: validatedUser.nom
        } : validatedUser.magasin || null
      }
    };
  }

  async getProfile(userId: string, entityType: string) {
    if (entityType === 'magasin') {
      const magasin = await this.prisma.magasin.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          adresse: true,
          telephone: true,
          manager: true,
          status: true,
        }
      });
      
      if (!magasin) {
        throw new UnauthorizedException('Magasin non trouvé');
      }
      
      return {
        id: magasin.id,
        email: magasin.email,
        nom: magasin.nom,
        role: UserRole.MAGASIN,
        magasin: {
          id: magasin.id,
          nom: magasin.nom,
          adresse: magasin.adresse,
          telephone: magasin.telephone,
          manager: magasin.manager
        }
      };
    } else if (entityType === 'chauffeur') {
      const chauffeur = await this.prisma.chauffeur.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          telephone: true,
          status: true,
        }
      });
      
      if (!chauffeur) {
        throw new UnauthorizedException('Chauffeur non trouvé');
      }
      
      return {
        id: chauffeur.id,
        email: chauffeur.email,
        nom: chauffeur.nom,
        prenom: chauffeur.prenom,
        role: UserRole.CHAUFFEUR,
        chauffeur: {
          id: chauffeur.id,
          nom: chauffeur.nom,
          prenom: chauffeur.prenom,
          telephone: chauffeur.telephone
        }
      };
    } else {
      // Utilisateur système
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { magasin: true }
      });
      
      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }
      
      return user;
    }
  }

  async getMe(userId: string, entityType: string) {
    if (entityType === 'magasin') {
      const magasin = await this.prisma.magasin.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          telephone: true,
        }
      });
      
      if (!magasin) {
        throw new UnauthorizedException('Magasin non trouvé');
      }
      
      return {
        id: magasin.id,
        name: magasin.nom,
        email: magasin.email,
        phone: magasin.telephone || '',
        role: 'magasin'
      };
    } else if (entityType === 'chauffeur') {
      const chauffeur = await this.prisma.chauffeur.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          telephone: true,
        }
      });
      
      if (!chauffeur) {
        throw new UnauthorizedException('Chauffeur non trouvé');
      }
      
      return {
        id: chauffeur.id,
        name: `${chauffeur.prenom || ''} ${chauffeur.nom}`.trim(),
        email: chauffeur.email,
        phone: chauffeur.telephone || '',
        role: 'chauffeur'
      };
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
        }
      });
      
      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }
      
      return {
        id: user.id,
        name: `${user.prenom || ''} ${user.nom}`.trim(),
        email: user.email,
        phone: '',
        role: 'admin'
      };
    }
  }

  async updateProfile(userId: string, entityType: string, updateData: UpdateProfileDto) {
    if (entityType === 'magasin') {
      const updateFields: any = {};
      if (updateData.name) updateFields.nom = updateData.name;
      if (updateData.email) updateFields.email = updateData.email;
      if (updateData.phone) updateFields.telephone = updateData.phone;

      await this.prisma.magasin.update({
        where: { id: userId },
        data: updateFields
      });
    } else if (entityType === 'chauffeur') {
      const updateFields: any = {};
      if (updateData.name) {
        const nameParts = updateData.name.trim().split(' ');
        updateFields.prenom = nameParts[0] || '';
        updateFields.nom = nameParts.slice(1).join(' ') || nameParts[0] || '';
      }
      if (updateData.email) updateFields.email = updateData.email;
      if (updateData.phone) updateFields.telephone = updateData.phone;

      await this.prisma.chauffeur.update({
        where: { id: userId },
        data: updateFields
      });
    } else {
      const updateFields: any = {};
      if (updateData.name) {
        const nameParts = updateData.name.trim().split(' ');
        updateFields.prenom = nameParts[0] || '';
        updateFields.nom = nameParts.slice(1).join(' ') || nameParts[0] || '';
      }
      if (updateData.email) updateFields.email = updateData.email;

      await this.prisma.user.update({
        where: { id: userId },
        data: updateFields
      });
    }

    return { success: true, message: 'Profil mis à jour' };
  }

  async updatePassword(userId: string, entityType: string, passwordData: UpdatePasswordDto) {
    // Vérifier le mot de passe actuel
    let currentHashedPassword: string;

    if (entityType === 'magasin') {
      const magasin = await this.prisma.magasin.findUnique({
        where: { id: userId },
        select: { password: true }
      });
      if (!magasin || !magasin.password) {
        throw new UnauthorizedException('Magasin non trouvé');
      }
      currentHashedPassword = magasin.password;
    } else if (entityType === 'chauffeur') {
      const chauffeur = await this.prisma.chauffeur.findUnique({
        where: { id: userId },
        select: { password: true }
      });
      if (!chauffeur || !chauffeur.password) {
        throw new UnauthorizedException('Chauffeur non trouvé');
      }
      currentHashedPassword = chauffeur.password;
    } else {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { password: true }
      });
      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }
      currentHashedPassword = user.password;
    }

    // Vérifier que le mot de passe actuel est correct
    const isCurrentPasswordValid = await bcrypt.compare(passwordData.currentPassword, currentHashedPassword);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    // Hasher le nouveau mot de passe
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(passwordData.newPassword, saltRounds);

    // Mettre à jour le mot de passe dans la bonne table
    if (entityType === 'magasin') {
      await this.prisma.magasin.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });
    } else if (entityType === 'chauffeur') {
      await this.prisma.chauffeur.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });
    } else {
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedNewPassword }
      });
    }

    return { success: true, message: 'Mot de passe mis à jour' };
  }
}