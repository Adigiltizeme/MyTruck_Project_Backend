import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { AirtableExtractor } from './extract-airtable';
import { RobustAirtableExtractor } from './extract-airtable-robust';

interface MigrationStats {
    table: string;
    imported: number;
    errors: number;
    skipped: number;
}

class PostgresMigrator {
    private prisma: PrismaClient;
    private dataDir: string;

    constructor() {
        this.prisma = new PrismaClient();
        this.dataDir = path.join(__dirname, '../data/airtable-export');
    }

    private readJsonFile(filename: string): any[] {
        const filepath = path.join(this.dataDir, filename);
        if (!fs.existsSync(filepath)) {
            console.log(`⚠️  Fichier non trouvé: ${filename}`);
            return [];
        }

        const content = fs.readFileSync(filepath, 'utf8');
        return JSON.parse(content);
    }

    async migrateMagasins(): Promise<MigrationStats> {
        console.log('📍 Migration des Magasins...');

        const data = this.readJsonFile('Magasins.json');
        const stats: MigrationStats = { table: 'Magasins', imported: 0, errors: 0, skipped: 0 };

        for (const record of data) {
            try {
                const fields = record.fields;

                await this.prisma.magasin.upsert({
                    where: { airtableId: record.id },
                    update: {
                        nom: fields['NOM DU MAGASIN'] || 'Nom inconnu',
                        adresse: fields['ADRESSE DU MAGASIN'] || '',
                        telephone: fields['TÉLÉPHONE'] || null,
                        email: fields['E-MAIL'] || null,
                        status: fields['STATUT'] || 'Actif',
                        categories: this.parseCategories(fields['CATEGORIE']),
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        airtableId: record.id,
                        nom: fields['NOM DU MAGASIN'] || 'Nom inconnu',
                        adresse: fields['ADRESSE DU MAGASIN'] || '',
                        telephone: fields['TÉLÉPHONE'] || null,
                        email: fields['E-MAIL'] || null,
                        status: fields['STATUT'] || 'Actif',
                        categories: this.parseCategories(fields['CATEGORIE']),
                        lastSyncedAt: new Date(),
                    },
                });

                stats.imported++;
            } catch (error) {
                console.error(`❌ Erreur migration magasin ${record.id}:`, error.message);
                stats.errors++;
            }
        }

        return stats;
    }

    async migratePersonnel(): Promise<MigrationStats> {
        console.log('👥 Migration du Personnel...');

        const data = this.readJsonFile('Personnel_My_Truck.json');
        const stats: MigrationStats = { table: 'Personnel', imported: 0, errors: 0, skipped: 0 };

        for (const record of data) {
            try {
                const fields = record.fields;
                const roles = this.parseRoles(fields['RÔLE']);

                // Créer d'abord le chauffeur si nécessaire
                if (roles.includes('Chauffeur')) {
                    await this.prisma.chauffeur.upsert({
                        where: { airtableId: record.id },
                        update: {
                            nom: fields['NOM'] || 'Nom inconnu',
                            prenom: fields['PRENOM'] || '',
                            telephone: fields['TELEPHONE'] || null,
                            email: fields['E-MAIL'] || null,
                            status: fields['STATUT'] || 'Actif',
                            longitude: fields['LONGITUDE'] || null,
                            latitude: fields['LATITUDE'] || null,
                            notes: fields['NOTES'] || null,
                            lastSyncedAt: new Date(),
                        },
                        create: {
                            airtableId: record.id,
                            nom: fields['NOM'] || 'Nom inconnu',
                            prenom: fields['PRENOM'] || '',
                            telephone: fields['TELEPHONE'] || null,
                            email: fields['E-MAIL'] || null,
                            status: fields['STATUT'] || 'Actif',
                            longitude: fields['LONGITUDE'] || null,
                            latitude: fields['LATITUDE'] || null,
                            notes: fields['NOTES'] || null,
                            lastSyncedAt: new Date(),
                        },
                    });
                }

                stats.imported++;
            } catch (error) {
                console.error(`❌ Erreur migration personnel ${record.id}:`, error.message);
                stats.errors++;
            }
        }

        return stats;
    }

    async migrateUsers(): Promise<MigrationStats> {
        console.log('👤 Migration des Users...');

        const data = this.readJsonFile('Users.json');
        const stats: MigrationStats = { table: 'Users', imported: 0, errors: 0, skipped: 0 };

        for (const record of data) {
            try {
                const fields = record.fields;

                // Générer un mot de passe par défaut
                const defaultPassword = 'MyTruck2024!';
                const hashedPassword = await bcrypt.hash(defaultPassword, 12);

                // Déterminer le rôle
                const role = this.mapUserRole(fields['RÔLE']);

                // Trouver le magasin associé si nécessaire
                let magasinId = null;
                if (fields['ENTREPRISE/MAGASIN'] && Array.isArray(fields['ENTREPRISE/MAGASIN'])) {
                    const magasin = await this.prisma.magasin.findFirst({
                        where: { airtableId: fields['ENTREPRISE/MAGASIN'][0] },
                    });
                    magasinId = magasin?.id || null;
                }

                await this.prisma.user.upsert({
                    where: { email: fields['E-MAIL'] || `user-${record.id}@mytruck.com` },
                    update: {
                        nom: fields['NOM D\'UTILISATEUR'] || 'Nom inconnu',
                        prenom: fields['PRENOM'] || null,
                        role: role,
                        magasinId: magasinId,
                        airtableId: record.id,
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        email: fields['E-MAIL'] || `user-${record.id}@mytruck.com`,
                        password: hashedPassword,
                        nom: fields['NOM D\'UTILISATEUR'] || 'Nom inconnu',
                        prenom: fields['PRENOM'] || null,
                        role: role,
                        magasinId: magasinId,
                        airtableId: record.id,
                        lastSyncedAt: new Date(),
                    },
                });

                stats.imported++;
            } catch (error) {
                console.error(`❌ Erreur migration user ${record.id}:`, error.message);
                stats.errors++;
            }
        }

        return stats;
    }

    async migrateAll(): Promise<void> {
        console.log('🚀 Début de la migration vers PostgreSQL...');

        try {
            await this.prisma.$connect();
            console.log('✅ Connexion à PostgreSQL établie');

            const results: MigrationStats[] = [];

            // Migration dans l'ordre des dépendances
            results.push(await this.migrateMagasins());
            results.push(await this.migratePersonnel());
            results.push(await this.migrateUsers());
            // TODO: Ajouter les autres tables

            // Résumé
            console.log('\n📊 Résumé de la migration:');
            results.forEach(stat => {
                console.log(`✅ ${stat.table}: ${stat.imported} importés, ${stat.errors} erreurs`);
            });

            const totalImported = results.reduce((sum, stat) => sum + stat.imported, 0);
            const totalErrors = results.reduce((sum, stat) => sum + stat.errors, 0);

            console.log(`\n🎯 Total: ${totalImported} enregistrements migrés`);
            console.log(`❌ Erreurs: ${totalErrors}`);

        } catch (error) {
            console.error('❌ Erreur générale de migration:', error);
        } finally {
            await this.prisma.$disconnect();
        }
    }

    // Méthodes utilitaires
    private parseCategories(categories: any): string[] {
        if (!categories) return [];
        if (typeof categories === 'string') return [categories];
        if (Array.isArray(categories)) return categories;
        return [];
    }

    private parseRoles(roles: any): string[] {
        if (!roles) return [];
        if (typeof roles === 'string') return [roles];
        if (Array.isArray(roles)) return roles;
        return [];
    }

    private mapUserRole(airtableRole: any): any {
        const roleMapping: { [key: string]: string } = {
            'Direction My Truck': 'DIRECTION',
            'Chauffeur': 'CHAUFFEUR',
            'Interlocuteur Truffaut Ivry': 'MAGASIN',
            'Section IT': 'ADMIN',
        };

        if (Array.isArray(airtableRole)) {
            // Prendre le premier rôle ou le plus prioritaire
            for (const role of airtableRole) {
                if (roleMapping[role]) {
                    return roleMapping[role];
                }
            }
        } else if (typeof airtableRole === 'string') {
            return roleMapping[airtableRole] || 'MAGASIN';
        }

        return 'MAGASIN'; // Rôle par défaut
    }
}

// Script principal
async function main() {
    const command = process.argv[2];

    try {
        switch (command) {
            case 'extract':
                const extractor = new RobustAirtableExtractor();
                await extractor.extractAllTables();
                break;

            case 'migrate':
                const migrator = new PostgresMigrator();
                await migrator.migrateAll();
                break;

            default:
                console.log('Usage:');
                console.log('  npm run extract  - Extraire les données d\'Airtable');
                console.log('  npm run migrate  - Migrer vers PostgreSQL');
        }
    } catch (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}