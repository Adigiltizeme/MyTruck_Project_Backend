import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Configuration CORS
  app.enableCors({
    origin: ['CORS_ORIGIN',
      'http://localhost:3001',   // Frontend dev
      'http://localhost:3000',   // Au cas où
      'http://localhost:5173',   // Vite parfois utilise ce port
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173'
    ],
    credentials: configService.get('CORS_CREDENTIALS', true),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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
  await app.listen(port);

  logger.log(`🚀 Application démarrée sur http://localhost:${port}`);
  logger.log(`📚 Documentation Swagger disponible sur http://localhost:${port}/${apiPrefix}/docs`);
}

bootstrap().catch((error) => {
  Logger.error('❌ Erreur lors du démarrage de l\'application', error);
  process.exit(1);
});