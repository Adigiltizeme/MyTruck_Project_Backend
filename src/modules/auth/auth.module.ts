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

@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '24h',
      },
      verifyOptions: {
        clockTolerance: 30, // 30 secondes de tolérance, // Assurez-vous que l'algorithme correspond à celui utilisé pour signer le JWT
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule { }