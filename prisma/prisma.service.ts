import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);

    constructor(private readonly configService: ConfigService) {
        super({
            datasources: {
                db: {
                    url: configService.get<string>('database.url'),
                },
            },
            log: [
                { emit: 'stdout', level: 'info' },
                { emit: 'stdout', level: 'warn' },
                { emit: 'stdout', level: 'error' },
            ],
            errorFormat: 'colorless',
        });
    }

    async onModuleInit() {
        this.logger.log('🔌 Connexion à la base de données...');

        try {
            await this.$connect();
            this.logger.log('✅ Base de données connectée avec succès');
        } catch (error) {
            this.logger.error('❌ Erreur de connexion à la base de données', error);
            throw error;
        }
    }

    async onModuleDestroy() {
        this.logger.log('🔌 Déconnexion de la base de données...');
        await this.$disconnect();
        this.logger.log('✅ Base de données déconnectée');
    }

    /**
     * Méthode utilitaire pour exécuter des requêtes avec gestion d'erreur
     */
    async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        context: string,
    ): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            this.logger.error(`❌ Erreur lors de ${context}:`, error);
            throw error;
        }
    }

    /**
     * Méthode pour vérifier la santé de la base de données
     */
    async healthCheck(): Promise<{ status: 'ok' | 'error'; timestamp: Date }> {
        try {
            await this.$queryRaw`SELECT 1`;
            return {
                status: 'ok',
                timestamp: new Date(),
            };
        } catch (error) {
            this.logger.error('❌ Health check DB failed:', error);
            return {
                status: 'error',
                timestamp: new Date(),
            };
        }
    }
}