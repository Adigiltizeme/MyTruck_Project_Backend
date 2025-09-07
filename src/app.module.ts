import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';

// Modules core
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { MeModule } from './modules/me/me.module';
import { SyncModule } from './modules/sync/sync.module';

// Modules métier (seulement ceux qui existent)
import { UsersModule } from './modules/users/users.module';
import { MagasinsModule } from './modules/magasins/magasins.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SlotsModule } from './modules/slots/slots.module';

// Modules utilitaires
import { HealthModule } from './modules/health/health.module';

// Configuration
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { authConfig } from './config/auth.config';
import { CommandesModule } from './modules/commandes/commandes.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ChauffeursModule } from './modules/chauffeurs/chauffeurs.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { SetupModule } from './setup/setup.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig],
      envFilePath: ['.env.local', '.env'],
      ignoreEnvFile: false,
      cache: false,
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
    MeModule,
    SyncModule,

    // Modules métier (par ordre de priorité)
    UsersModule,
    MagasinsModule,
    TrackingModule,
    NotificationsModule,
    WebSocketModule,
    DocumentsModule,
    SlotsModule,

    // Modules utilitaires
    HealthModule,
    SetupModule,

    CommandesModule,

    ClientsModule,

    ChauffeursModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {
  constructor(private configService: ConfigService) {
    // ✅ DEBUG au démarrage du module
    console.log('🔍 ConfigModule chargé:');
    console.log('JWT_SECRET via config:', !!this.configService.get('JWT_SECRET'));
    console.log('Toutes les variables:', Object.keys(process.env).filter(k => k.includes('JWT')));
  }
}