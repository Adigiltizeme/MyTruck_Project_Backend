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
    const user = await this.prisma.user.findUnique({
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

    const now = Math.floor(Date.now() / 1000);
    const exp = payload.exp;
    const timeDiff = exp - now;

    console.log(`🕐 JWT Validation - Time diff: ${timeDiff}s (exp: ${new Date(exp * 1000).toISOString()})`);

    if (timeDiff < -30) { // Plus de 30s de retard
      console.error(`❌ Token vraiment expiré: ${-timeDiff}s de retard`);
      throw new UnauthorizedException('Token expiré');
    }

    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      magasinId: user.magasinId,
      magasin: user.magasin,
    };
  }
}