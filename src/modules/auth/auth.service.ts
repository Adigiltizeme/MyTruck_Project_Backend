// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { InjectRepository } from '@nestjs/typeorm';
// import { MoreThan, Repository } from 'typeorm';
// import { UsersService } from '../users/users.service';
// import { RefreshToken } from './entities/refresh-token.entity';
// import * as bcrypt from 'bcrypt';
// import { v4 as uuidv4 } from 'uuid';
// import * as crypto from 'crypto';
// import { PasswordReset } from './entities/password-reset.entity';
// import { MailService } from '../../shared/services/mail.service';

// @Injectable()
// export class AuthService {
//   constructor(
//     @InjectRepository(PasswordReset)
//     private passwordResetRepository: Repository<PasswordReset>,
//     private mailService: MailService,
//     private usersService: UsersService,
//     private jwtService: JwtService,
//     @InjectRepository(RefreshToken)
//     private refreshTokenRepository: Repository<RefreshToken>,
    
//   ) {}

//   async validateUser(email: string, password: string): Promise<any> {
//     const user = await this.usersService.findByEmail(email);
//     if (user && await bcrypt.compare(password, user.password)) {
//       const { password, ...result } = user;
//       return result;
//     }
//     throw new UnauthorizedException('Email ou mot de passe incorrect');
//   }

//   async login(user: any) {
//     const payload = { 
//       email: user.email, 
//       sub: user.id,
//       role: user.role 
//     };
    
//     // Générer le refresh token
//     const refreshToken = await this.createRefreshToken(user);

//     return {
//       access_token: this.jwtService.sign(payload),
//       refresh_token: refreshToken.token,
//       user: {
//         id: user.id,
//         email: user.email,
//         role: user.role
//       }
//     };
//   }

//   private async createRefreshToken(user: any): Promise<RefreshToken> {
//     const token = uuidv4();
//     const expiresAt = new Date();
//     expiresAt.setDate(expiresAt.getDate() + 7); // Expire dans 7 jours

//     const refreshToken = this.refreshTokenRepository.create({
//       token,
//       expiresAt,
//       user,
//     });

//     return this.refreshTokenRepository.save(refreshToken);
//   }

//   async refreshAccessToken(refreshTokenString: string) {
//     const refreshToken = await this.refreshTokenRepository.findOne({
//       where: { token: refreshTokenString, isRevoked: false },
//       relations: ['user'],
//     });

//     if (!refreshToken || new Date() > refreshToken.expiresAt) {
//       throw new UnauthorizedException('Invalid refresh token');
//     }

//     const payload = { 
//       email: refreshToken.user.email, 
//       sub: refreshToken.user.id,
//       role: refreshToken.user.role 
//     };

//     return {
//       access_token: this.jwtService.sign(payload),
//     };
//   }

//   async logout(userId: string) {
//     await this.refreshTokenRepository.update(
//       { user: { id: userId } },
//       { isRevoked: true }
//     );
//     return { success: true };
//   }

//   async requestPasswordReset(email: string): Promise<void> {
//     const user = await this.usersService.findByEmail(email);
//     if (!user) {
//       // Ne pas révéler si l'email existe
//       return;
//     }

//     const token = crypto.randomBytes(32).toString('hex');
//     const expiresAt = new Date();
//     expiresAt.setHours(expiresAt.getHours() + 1);

//     await this.passwordResetRepository.save({
//       email,
//       token,
//       expiresAt,
//     });

//     await this.mailService.sendPasswordReset(email, token);
//   }

//   async resetPassword(token: string, newPassword: string): Promise<void> {
//     const resetRequest = await this.passwordResetRepository.findOne({
//       where: {
//         token,
//         isUsed: false,
//         expiresAt: MoreThan(new Date()),
//       },
//     });

//     if (!resetRequest) {
//       throw new UnauthorizedException('Token invalide ou expiré');
//     }

//     const user = await this.usersService.findByEmail(resetRequest.email);
//     await this.usersService.updatePassword(user.id, newPassword);

//     await this.passwordResetRepository.update(
//       { id: resetRequest.id },
//       { isUsed: true }
//     );
//   }
// }

import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    this.logger.debug(`🔍 Validation utilisateur: ${email}`);
    
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        magasin: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });

    if (!user) {
      this.logger.warn(`❌ Utilisateur non trouvé: ${email}`);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`❌ Mot de passe incorrect pour: ${email}`);
      return null;
    }

    this.logger.debug(`✅ Utilisateur validé: ${email}`);
    const { password: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      magasinId: user.magasinId,
    };

    const accessToken = this.jwtService.sign(payload);

    this.logger.log(`✅ Connexion réussie pour: ${email}`);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
        status: user.status,
        magasin: user.magasin,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    const { email, password, nom, prenom, role, magasinId } = registerDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Hashage du mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Créer l'utilisateur
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nom,
        prenom,
        role,
        magasinId,
      },
      include: {
        magasin: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });

    this.logger.log(`✅ Nouvel utilisateur créé: ${email}`);

    // Connecter automatiquement après l'inscription
    return this.login({ email, password });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        status: true,
        magasin: {
          select: {
            id: true,
            nom: true,
            adresse: true,
            telephone: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    return user;
  }
}