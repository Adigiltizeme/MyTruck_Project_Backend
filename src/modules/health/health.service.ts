import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class HealthService {
    constructor(private readonly prisma: PrismaService) { }

    async checkHealth() {
        const checks = {
            api: { status: 'ok', timestamp: new Date() },
            database: await this.prisma.healthCheck(),
        };

        const isHealthy = Object.values(checks).every(check => check.status === 'ok');

        return {
            status: isHealthy ? 'ok' : 'error',
            timestamp: new Date(),
            checks,
        };
    }

    async getVersion() {
        try {
            // Lire la version depuis package.json
            const packageJsonPath = path.join(process.cwd(), 'package.json');

            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                return {
                    version: packageJson.version || '1.0.0',
                    name: packageJson.name || 'mytruck-backend',
                    environment: process.env.NODE_ENV || 'development',
                };
            } else {
                // Fallback si package.json n'est pas trouvé
                return {
                    version: '1.0.0',
                    name: 'mytruck-backend',
                    environment: process.env.NODE_ENV || 'development',
                };
            }
        } catch (error) {
            console.error('Erreur lecture version:', error);
            return {
                version: '1.0.0',
                name: 'mytruck-backend',
                environment: process.env.NODE_ENV || 'development',
                error: 'Could not read package.json',
            };
        }
    }
}