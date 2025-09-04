// import { Injectable, UnauthorizedException } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { ConfigService } from '@nestjs/config';
// import { ExtractJwt, Strategy } from 'passport-jwt';
// import { PrismaService } from '../../../../prisma/prisma.service';

// @Injectable()
// export class JwtStrategy extends PassportStrategy(Strategy) {
//   constructor(
//     private readonly configService: ConfigService,
//     private readonly prisma: PrismaService,
//   ) {
//     super({
//       jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
//       ignoreExpiration: false,
//       secretOrKey: configService.get<string>('auth.jwt.secret'),
//     });
//   }

//   async validate(payload: any) {
//     const user = await this.prisma.user.findUnique({
//       where: { id: payload.sub },
//       include: {
//         magasin: {
//           select: {
//             id: true,
//             nom: true,
//           },
//         },
//       },
//     });

//     if (!user || user.status !== 'Actif') {
//       throw new UnauthorizedException();
//     }

//     return {
//       id: user.id,
//       email: user.email,
//       nom: user.nom,
//       prenom: user.prenom,
//       role: user.role,
//       magasinId: user.magasinId,
//       magasin: user.magasin,
//     };
//   }
// }

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
      clockTolerance: 30, // 30 secondes de tolérance
    });
  }

  async validate(payload: any) {
    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp;
    const timeDiff = exp - now;

    console.log(`🕐 JWT Validation - Time diff: ${timeDiff}s (exp: ${new Date(exp * 1000).toISOString()})`);

    if (timeDiff < -30) { // Plus de 30s de retard
      console.error(`❌ Token vraiment expiré: ${-timeDiff}s de retard`);
      throw new UnauthorizedException('Token expiré');
    }

    let entity = null;

    // Valider selon le type d'entité
    if (payload.entityType === 'magasin') {
      entity = await this.prisma.magasin.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          nom: true,
          status: true,
          hasAccount: true,
          accountStatus: true,
        },
      });

      if (!entity || !entity.hasAccount || entity.accountStatus !== 'active') {
        throw new UnauthorizedException('Compte magasin inactif ou non configuré');
      }

      return {
        id: entity.id,
        email: entity.email,
        nom: entity.nom,
        role: payload.role,
        entityType: 'magasin',
        sub: payload.sub,
        magasin: {
          id: entity.id,
          nom: entity.nom,
        },
      };
    } else if (payload.entityType === 'chauffeur') {
      entity = await this.prisma.chauffeur.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          status: true,
          hasAccount: true,
          accountStatus: true,
        },
      });

      if (!entity || !entity.hasAccount || entity.accountStatus !== 'active') {
        throw new UnauthorizedException('Compte chauffeur inactif ou non configuré');
      }

      return {
        id: entity.id,
        email: entity.email,
        nom: entity.nom,
        prenom: entity.prenom,
        role: payload.role,
        entityType: 'chauffeur',
        sub: payload.sub,
        chauffeur: {
          id: entity.id,
          nom: entity.nom,
          prenom: entity.prenom,
        },
      };
    } else {
      // Utilisateur système
      entity = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          magasin: {
            select: {
              id: true,
              nom: true,
            },
          },
        },
      });

      if (!entity || entity.status !== 'Actif') {
        throw new UnauthorizedException('Compte utilisateur inactif');
      }

      return {
        id: entity.id,
        email: entity.email,
        nom: entity.nom,
        prenom: entity.prenom,
        role: entity.role,
        entityType: 'user',
        sub: payload.sub,
        magasinId: entity.magasinId,
        magasin: entity.magasin,
      };
    }
  }
}