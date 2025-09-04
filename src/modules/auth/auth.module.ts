// import { Module } from '@nestjs/common';
// import { JwtModule } from '@nestjs/jwt';
// import { PassportModule } from '@nestjs/passport';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { ThrottlerModule } from '@nestjs/throttler';
// import { AuthService } from './auth.service';
// import { AuthController } from './auth.controller';
// import { JwtStrategy } from './strategies/jwt.strategy';
// import { LocalStrategy } from './strategies/local.strategy';
// import { UsersModule } from '../users/users.module';
// import { SharedModule } from '../../shared/shared.module';
// import { RefreshToken } from './entities/refresh-token.entity';
// import { PasswordReset } from './entities/password-reset.entity';

// @Module({
//   imports: [
//     SharedModule,
//     UsersModule,
//     PassportModule,
//     ThrottlerModule.forRoot([{
//       ttl: 10,
//       limit: 3,
//     }]),
//     TypeOrmModule.forFeature([RefreshToken, PasswordReset]),
//     JwtModule.registerAsync({
//       imports: [ConfigModule],
//       useFactory: async (configService: ConfigService) => ({
//         secret: configService.get('JWT_SECRET'),
//         signOptions: { expiresIn: '24h' },
//       }),
//       inject: [ConfigService],
//     }),
//   ],
//   providers: [AuthService, JwtStrategy, LocalStrategy],
//   controllers: [AuthController],
//   exports: [AuthService],
// })
// export class AuthModule {}

// import { Module } from '@nestjs/common';
// import { JwtModule } from '@nestjs/jwt';
// import { PassportModule } from '@nestjs/passport';
// import { ConfigModule, ConfigService } from '@nestjs/config';

// import { AuthController } from './auth.controller';
// import { AuthService } from './auth.service';
// import { JwtStrategy } from './strategies/jwt.strategy';
// import { LocalStrategy } from './strategies/local.strategy';
// import { UsersModule } from '../users/users.module';

// @Module({
//   imports: [
//     PassportModule,
//     JwtModule.registerAsync({
//       imports: [ConfigModule],
//       inject: [ConfigService],
//       useFactory: (configService: ConfigService) => ({
//         secret: configService.get<string>('auth.jwt.secret'),
//         signOptions: {
//           expiresIn: configService.get<string>('auth.jwt.expiresIn'),
//         },
//       }),
//     }),
//     UsersModule,
//   ],
//   controllers: [AuthController],
//   providers: [AuthService, JwtStrategy, LocalStrategy],
//   exports: [AuthService],
// })
// export class AuthModule {}

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        let jwtSecret = configService.get<string>('JWT_SECRET') || '';

        console.log('🔍 JWT Secret brut longueur:', jwtSecret.length);
        console.log('🔍 JWT Secret aperçu:', jwtSecret.substring(0, 20) + '...');

        // ✅ NETTOYAGE COMPLET
        jwtSecret = jwtSecret
          .replace(/['"]/g, '')           // Enlever guillemets
          .replace(/\r?\n/g, '')          // Enlever retours à la ligne
          .replace(/\s+/g, '')            // Enlever espaces multiples
          .trim();                        // Enlever espaces début/fin

        console.log('🔍 JWT Secret nettoyé longueur:', jwtSecret.length);
        console.log('🔍 JWT Secret nettoyé aperçu:', jwtSecret.substring(0, 20) + '...');

        if (jwtSecret.length < 32) {
          throw new Error(`JWT_SECRET trop court après nettoyage: ${jwtSecret.length} caractères`);
        }

        return {
          secret: jwtSecret,
          signOptions: { expiresIn: '24h' },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule { }