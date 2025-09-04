import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Configuration CORS - Autoriser toutes les origines pour ngrok
  app.enableCors({
    origin: true, // Autoriser toutes les origines (développement uniquement)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'ngrok-skip-browser-warning', 'X-Requested-With'],
    preflightContinue: false,
    optionsSuccessStatus: 204
  });

  // Préfixe global pour l'API
  const apiPrefix = configService.get('API_PREFIX', 'api');
  const apiVersion = configService.get('API_VERSION', 'v1');
  app.setGlobalPrefix(`${apiPrefix}/${apiVersion}`);

  // Validation globale des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Supprime les propriétés non définies dans le DTO
      forbidNonWhitelisted: true, // Lève une erreur si des propriétés non autorisées sont présentes
      transform: true, // Transforme automatiquement les types
      transformOptions: {
        enableImplicitConversion: true, // Conversion automatique des types primitifs
      },
    }),
  );

  // Configuration Swagger
  const config = new DocumentBuilder()
    .setTitle('My Truck Transport API')
    .setDescription('API pour la gestion des livraisons My Truck Transport')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('slots', 'Gestion des créneaux de livraison')
    .addServer(`http://localhost:${configService.get('PORT', 3000)}`, 'Local server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Démarrage du serveur
  const port = configService.get('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Application démarrée sur http://localhost:${port}`);
  logger.log(`📚 Documentation Swagger disponible sur http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap().catch((error) => {
  Logger.error('❌ Erreur lors du démarrage de l\'application', error);
  process.exit(1);
});