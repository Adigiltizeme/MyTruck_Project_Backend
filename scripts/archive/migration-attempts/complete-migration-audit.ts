import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface MigrationAudit {
    entity: string;
    airtable_count: number;
    postgres_count: number;
    migrated_count: number;
    missing_count: number;
    migration_rate: number;
    issues: string[];
}

export class CompleteMigrationAudit {

    async runCompleteAudit(): Promise<void> {
        console.log('🔍 AUDIT COMPLET DE LA MIGRATION\n');
        console.log('='.repeat(80));

        const audits: MigrationAudit[] = [];

        // Auditer chaque type d'entité
        audits.push(await this.auditEntity('Users', 'users', 'user'));
        audits.push(await this.auditEntity('Magasins', 'magasins', 'magasin'));
        audits.push(await this.auditEntity('Clients', 'clients', 'client'));
        audits.push(await this.auditEntity('Chauffeurs', 'chauffeurs', 'chauffeur'));
        audits.push(await this.auditEntity('Commandes', 'commandes', 'commande'));

        // Afficher le rapport global
        this.displayGlobalReport(audits);

        // Identifier les données manquantes spécifiques
        await this.identifyMissingData();
    }

    private async auditEntity(entityName: string, airtableFile: string, prismaModel: string): Promise<MigrationAudit> {
        console.log(`\n🔍 Audit ${entityName}...`);

        const audit: MigrationAudit = {
            entity: entityName,
            airtable_count: 0,
            postgres_count: 0,
            migrated_count: 0,
            missing_count: 0,
            migration_rate: 0,
            issues: []
        };

        try {
            // Compter les données Airtable
            const airtablePath = `./data/airtable-export/${this.capitalizeFirst(airtableFile)}.json`;
            if (fs.existsSync(airtablePath)) {
                const airtableData = JSON.parse(fs.readFileSync(airtablePath, 'utf8'));
                audit.airtable_count = airtableData.length;
            } else {
                audit.issues.push(`Fichier Airtable ${airtablePath} non trouvé`);
            }

            // Compter les données PostgreSQL
            let postgresCount = 0;
            let migratedCount = 0;

            switch (prismaModel) {
                case 'user':
                    postgresCount = await prisma.user.count();
                    migratedCount = await prisma.user.count({ where: { airtableId: { not: null } } });
                    break;
                case 'magasin':
                    postgresCount = await prisma.magasin.count();
                    migratedCount = await prisma.magasin.count({ where: { airtableId: { not: null } } });
                    break;
                case 'client':
                    postgresCount = await prisma.client.count();
                    migratedCount = await prisma.client.count({ where: { airtableId: { not: null } } });
                    break;
                case 'chauffeur':
                    postgresCount = await prisma.chauffeur.count();
                    migratedCount = await prisma.chauffeur.count({ where: { airtableId: { not: null } } });
                    break;
                case 'commande':
                    postgresCount = await prisma.commande.count();
                    migratedCount = await prisma.commande.count({ where: { airtableId: { not: null } } });
                    break;
            }

            audit.postgres_count = postgresCount;
            audit.migrated_count = migratedCount;
            audit.missing_count = audit.airtable_count - audit.migrated_count;
            audit.migration_rate = audit.airtable_count > 0 ? (audit.migrated_count / audit.airtable_count) * 100 : 0;

            // Identifier les problèmes
            if (audit.missing_count > 0) {
                audit.issues.push(`${audit.missing_count} enregistrements Airtable non migrés`);
            }

            const nonMigratedInPostgres = audit.postgres_count - audit.migrated_count;
            if (nonMigratedInPostgres > 0) {
                audit.issues.push(`${nonMigratedInPostgres} enregistrements PostgreSQL sans origine Airtable`);
            }

            console.log(`   📊 Airtable: ${audit.airtable_count} | PostgreSQL: ${audit.postgres_count} | Migrés: ${audit.migrated_count} | Manquants: ${audit.missing_count}`);
            console.log(`   📈 Taux de migration: ${audit.migration_rate.toFixed(1)}%`);

            if (audit.issues.length > 0) {
                console.log(`   ⚠️ Problèmes: ${audit.issues.join(', ')}`);
            }

        } catch (error) {
            console.error(`   ❌ Erreur audit ${entityName}:`, error);
            audit.issues.push(`Erreur lors de l'audit: ${error.message}`);
        }

        return audit;
    }

    private displayGlobalReport(audits: MigrationAudit[]): void {
        console.log('\n\n📊 ========== RAPPORT GLOBAL ==========\n');

        let totalAirtable = 0;
        let totalMigrated = 0;
        let entitiesWithIssues = 0;

        console.log('┌─────────────┬─────────────┬─────────────┬─────────────┬──────────────┐');
        console.log('│   Entité    │  Airtable   │ PostgreSQL  │   Migrés    │ Taux (%)     │');
        console.log('├─────────────┼─────────────┼─────────────┼─────────────┼──────────────┤');

        audits.forEach(audit => {
            totalAirtable += audit.airtable_count;
            totalMigrated += audit.migrated_count;

            if (audit.issues.length > 0) {
                entitiesWithIssues++;
            }

            const status = audit.migration_rate === 100 ? '✅' : audit.migration_rate >= 80 ? '⚠️' : '❌';

            console.log(`│ ${audit.entity.padEnd(11)} │ ${audit.airtable_count.toString().padStart(11)} │ ${audit.postgres_count.toString().padStart(11)} │ ${audit.migrated_count.toString().padStart(11)} │ ${audit.migration_rate.toFixed(1).padStart(10)}% ${status} │`);
        });

        console.log('├─────────────┼─────────────┼─────────────┼─────────────┼──────────────┤');
        const globalRate = totalAirtable > 0 ? (totalMigrated / totalAirtable) * 100 : 0;
        console.log(`│ TOTAL       │ ${totalAirtable.toString().padStart(11)} │ ${'-'.padStart(11)} │ ${totalMigrated.toString().padStart(11)} │ ${globalRate.toFixed(1).padStart(10)}% │`);
        console.log('└─────────────┴─────────────┴─────────────┴─────────────┴──────────────┘');

        console.log(`\n📈 RÉSUMÉ GLOBAL:`);
        console.log(`   • Migration globale: ${globalRate.toFixed(1)}% (${totalMigrated}/${totalAirtable})`);
        console.log(`   • Entités avec problèmes: ${entitiesWithIssues}/${audits.length}`);

        if (globalRate === 100) {
            console.log(`   🎉 MIGRATION PARFAITE !`);
        } else if (globalRate >= 90) {
            console.log(`   ✅ Migration très bonne, corrections mineures nécessaires`);
        } else {
            console.log(`   ⚠️ Migration incomplète, actions correctives requises`);
        }
    }

    private async identifyMissingData(): Promise<void> {
        console.log('\n\n🔍 ========== DONNÉES MANQUANTES DÉTAILLÉES ==========\n');

        // Chauffeurs manquants (vous avez mentionné ce problème)
        await this.identifyMissingChauffeurs();

        // Autres entités manquantes
        await this.identifyMissingUsers();
        await this.identifyMissingMagasins();
        await this.identifyMissingClients();
    }

    private async identifyMissingChauffeurs(): Promise<void> {
        console.log('🚛 Analyse des chauffeurs manquants...');

        try {
            const airtableData = JSON.parse(fs.readFileSync('./data/airtable-export/Chauffeurs.json', 'utf8'));
            const postgresData = await prisma.chauffeur.findMany({
                select: { airtableId: true, nom: true, prenom: true }
            });

            const migratedIds = new Set(postgresData.map(c => c.airtableId).filter(Boolean));
            const missingChauffeurs = airtableData.filter(c => !migratedIds.has(c.id));

            if (missingChauffeurs.length > 0) {
                console.log(`❌ ${missingChauffeurs.length} chauffeurs non migrés:`);
                missingChauffeurs.forEach((chauffeur, index) => {
                    const nom = chauffeur.fields['NOM'] || 'N/A';
                    const prenom = chauffeur.fields['PRENOM'] || 'N/A';
                    console.log(`   ${index + 1}. ${prenom} ${nom} (ID: ${chauffeur.id})`);
                });
            } else {
                console.log('✅ Tous les chauffeurs sont migrés');
            }

        } catch (error) {
            console.error('❌ Erreur analyse chauffeurs:', error);
        }
    }

    private async identifyMissingUsers(): Promise<void> {
        console.log('\n👥 Analyse des utilisateurs manquants...');

        try {
            const airtableData = JSON.parse(fs.readFileSync('./data/airtable-export/Users.json', 'utf8'));
            const postgresData = await prisma.user.findMany({
                select: { airtableId: true, email: true }
            });

            const migratedIds = new Set(postgresData.map(u => u.airtableId).filter(Boolean));
            const missingUsers = airtableData.filter(u => !migratedIds.has(u.id));

            if (missingUsers.length > 0) {
                console.log(`❌ ${missingUsers.length} utilisateurs non migrés:`);
                missingUsers.forEach((user, index) => {
                    const email = user.fields['EMAIL'] || 'N/A';
                    const nom = user.fields['NOM'] || 'N/A';
                    console.log(`   ${index + 1}. ${email} (${nom}) - ID: ${user.id}`);
                });
            } else {
                console.log('✅ Tous les utilisateurs sont migrés');
            }

        } catch (error) {
            console.error('❌ Erreur analyse utilisateurs:', error);
        }
    }

    private async identifyMissingMagasins(): Promise<void> {
        console.log('\n🏪 Analyse des magasins manquants...');

        try {
            const airtableData = JSON.parse(fs.readFileSync('./data/airtable-export/Magasins.json', 'utf8'));
            const postgresData = await prisma.magasin.findMany({
                select: { airtableId: true, nom: true }
            });

            const migratedIds = new Set(postgresData.map(m => m.airtableId).filter(Boolean));
            const missingMagasins = airtableData.filter(m => !migratedIds.has(m.id));

            if (missingMagasins.length > 0) {
                console.log(`❌ ${missingMagasins.length} magasins non migrés:`);
                missingMagasins.forEach((magasin, index) => {
                    const nom = magasin.fields['NOM'] || 'N/A';
                    console.log(`   ${index + 1}. ${nom} - ID: ${magasin.id}`);
                });
            } else {
                console.log('✅ Tous les magasins sont migrés');
            }

        } catch (error) {
            console.error('❌ Erreur analyse magasins:', error);
        }
    }

    private async identifyMissingClients(): Promise<void> {
        console.log('\n👤 Analyse des clients manquants...');

        try {
            const airtableData = JSON.parse(fs.readFileSync('./data/airtable-export/Clients.json', 'utf8'));
            const postgresData = await prisma.client.findMany({
                select: { airtableId: true, nom: true, prenom: true }
            });

            const migratedIds = new Set(postgresData.map(c => c.airtableId).filter(Boolean));
            const missingClients = airtableData.filter(c => !migratedIds.has(c.id));

            if (missingClients.length > 0) {
                console.log(`❌ ${missingClients.length} clients non migrés:`);
                missingClients.forEach((client, index) => {
                    const nom = client.fields['NOM'] || 'N/A';
                    const prenom = client.fields['PRENOM'] || 'N/A';
                    console.log(`   ${index + 1}. ${prenom} ${nom} - ID: ${client.id}`);
                });
            } else {
                console.log('✅ Tous les clients sont migrés');
            }

        } catch (error) {
            console.error('❌ Erreur analyse clients:', error);
        }
    }

    private capitalizeFirst(str: string): string {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// Script principal
async function main() {
    const auditor = new CompleteMigrationAudit();

    try {
        await auditor.runCompleteAudit();

    } catch (error) {
        console.error('❌ Erreur audit complet:', error);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}