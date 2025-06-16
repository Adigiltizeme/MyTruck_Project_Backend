import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Modules core
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';

// Modules métier (seulement ceux qui existent)
import { UsersModule } from './modules/users/users.module';
import { MagasinsModule } from './modules/magasins/magasins.module';

// Modules utilitaires
import { HealthModule } from './modules/health/health.module';

// Configuration
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { authConfig } from './config/auth.config';
import { CommandesModule } from './modules/commandes/commandes.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ChauffeursModule } from './modules/chauffeurs/chauffeurs.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig],
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60, // 60 secondes
        limit: 100, // 100 requêtes par minute
      },
    ]),

    // Tâches planifiées
    ScheduleModule.forRoot(),

    // Modules core
    PrismaModule,
    AuthModule,

    // Modules métier (par ordre de priorité)
    UsersModule,
    MagasinsModule,

    // Modules utilitaires
    HealthModule,

    CommandesModule,

    ClientsModule,

    ChauffeursModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}