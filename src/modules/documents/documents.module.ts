import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { PrismaModule } from '../../../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
    imports:
        [
            PrismaModule,
            CloudinaryModule,
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
    controllers: [DocumentsController],
    providers: [DocumentsService],
    exports: [DocumentsService],
})
export class DocumentsModule { }