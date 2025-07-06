import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface MigrationConfig {
    entity: string;
    airtableFile: string;
    prismaModel: string;
    dependencies: string[];
    priority: number;
}

interface MigrationResult {
    entity: string;
    success: number;
    errors: number;
    skipped: number;
    duplicates: number;
    total: number;
    issues: string[];
}

interface GlobalMigrationStats {
    entities: MigrationResult[];
    totalProcessed: number;
    totalSuccess: number;
    totalErrors: number;
    startTime: Date;
    endTime?: Date;
    duration?: number;
}

export class CompleteMigrationSystem {
    private migrationOrder: MigrationConfig[] = [
        // Ordre de priorité pour respecter les dépendances FK
        { entity: 'Users', airtableFile: 'Users.json', prismaModel: 'user', dependencies: [], priority: 1 },
        { entity: 'Magasins', airtableFile: 'Magasins.json', prismaModel: 'magasin', dependencies: [], priority: 2 },
        { entity: 'Clients', airtableFile: 'Clients.json', prismaModel: 'client', dependencies: [], priority: 3 },
        { entity: 'Chauffeurs', airtableFile: 'Personnel_My_Truck.json', prismaModel: 'chauffeur', dependencies: [], priority: 4 },
        { entity: 'Commandes', airtableFile: 'Commandes.json', prismaModel: 'commande', dependencies: ['Magasins', 'Clients'], priority: 5 },
        // Entités supplémentaires (optionnelles)
        { entity: 'Devis', airtableFile: 'Devis.json', prismaModel: 'devis', dependencies: ['Magasins', 'Commandes'], priority: 6 },
        { entity: 'Factures', airtableFile: 'Factures.json', prismaModel: 'facture', dependencies: ['Magasins', 'Commandes'], priority: 7 }
    ];

    private stats: GlobalMigrationStats = {
        entities: [],
        totalProcessed: 0,
        totalSuccess: 0,
        totalErrors: 0,
        startTime: new Date()
    };

    async executeCompleteMigration(options: {
        forceRecreate?: boolean;
        skipExisting?: boolean;
        entitiesFilter?: string[];
    } = {}): Promise<GlobalMigrationStats> {

        console.log('🚀 SYSTÈME DE MIGRATION COMPLÈTE MY TRUCK TRANSPORT');
        console.log('='.repeat(80));
        console.log(`📅 Démarrage: ${this.stats.startTime.toLocaleString()}`);
        console.log(`⚙️ Options: Force=${options.forceRecreate}, Skip=${options.skipExisting}\n`);

        try {
            // 1. Validation pré-migration
            await this.preMigrationValidation();

            // 2. Nettoyage si demandé
            if (options.forceRecreate) {
                await this.cleanDatabase();
            }

            // 3. Migration de chaque entité dans l'ordre
            const entitiesToMigrate = options.entitiesFilter
                ? this.migrationOrder.filter(e => options.entitiesFilter!.includes(e.entity))
                : this.migrationOrder;

            for (const config of entitiesToMigrate) {
                const result = await this.migrateEntity(config, options);
                this.stats.entities.push(result);
                this.stats.totalProcessed += result.total;
                this.stats.totalSuccess += result.success;
                this.stats.totalErrors += result.errors;
            }

            // 4. Validation post-migration
            await this.postMigrationValidation();

            // 5. Rapport final
            this.stats.endTime = new Date();
            this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

            await this.generateFinalReport();

        } catch (error) {
            console.error('❌ Erreur critique migration:', error);
            throw error;
        }

        return this.stats;
    }

    private async preMigrationValidation(): Promise<void> {
        console.log('🔍 Validation pré-migration...');

        // Vérifier la connexion base de données
        try {
            await prisma.$queryRaw`SELECT 1`;
            console.log('✅ Connexion PostgreSQL OK');
        } catch (error) {
            throw new Error('❌ Impossible de se connecter à PostgreSQL');
        }

        // Vérifier l'existence des fichiers Airtable
        const exportDir = './data/airtable-export/';
        if (!fs.existsSync(exportDir)) {
            throw new Error(`❌ Dossier d'export Airtable non trouvé: ${exportDir}`);
        }

        const files = fs.readdirSync(exportDir);
        console.log(`📁 ${files.length} fichiers d'export trouvés`);

        // Vérifier chaque fichier requis
        for (const config of this.migrationOrder) {
            const filePath = path.join(exportDir, config.airtableFile);
            if (!fs.existsSync(filePath)) {
                console.warn(`⚠️ Fichier manquant: ${config.airtableFile}`);
            } else {
                try {
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    console.log(`✅ ${config.entity}: ${data.length} enregistrements`);
                } catch {
                    console.warn(`⚠️ ${config.entity}: fichier JSON invalide`);
                }
            }
        }

        console.log('✅ Validation pré-migration terminée\n');
    }

    private async cleanDatabase(): Promise<void> {
        console.log('🧹 Nettoyage de la base de données...');
        console.warn('⚠️ ATTENTION: Suppression de toutes les données existantes !');

        try {
            // Supprimer dans l'ordre inverse pour respecter les FK
            const entities = ['factures', 'devis', 'commandes', 'chauffeurs', 'clients', 'magasins', 'users'];

            for (const entity of entities) {
                try {
                    const result = await prisma.$executeRawUnsafe(`DELETE FROM ${entity} WHERE airtable_id IS NOT NULL`);
                    console.log(`   🗑️ ${entity}: ${result} enregistrements supprimés`);
                } catch (error) {
                    console.warn(`   ⚠️ ${entity}: ${error.message}`);
                }
            }

            console.log('✅ Nettoyage terminé\n');
        } catch (error) {
            console.error('❌ Erreur nettoyage:', error);
            throw error;
        }
    }

    private async migrateEntity(config: MigrationConfig, options: any): Promise<MigrationResult> {
        console.log(`\n📦 Migration ${config.entity}...`);
        console.log('-'.repeat(50));

        const result: MigrationResult = {
            entity: config.entity,
            success: 0,
            errors: 0,
            skipped: 0,
            duplicates: 0,
            total: 0,
            issues: []
        };

        try {
            // Charger les données Airtable
            const filePath = `./data/airtable-export/${config.airtableFile}`;
            if (!fs.existsSync(filePath)) {
                result.issues.push(`Fichier ${config.airtableFile} non trouvé`);
                return result;
            }

            let airtableData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

            // Filtrage spécial pour les chauffeurs dans Personnel_My_Truck
            if (config.entity === 'Chauffeurs') {
                airtableData = airtableData.filter(person => {
                    const roles = person.fields['RÔLE'] || person.fields['ROLE'] || [];
                    return Array.isArray(roles) ? roles.includes('Chauffeur') :
                        typeof roles === 'string' ? roles.toLowerCase().includes('chauffeur') : false;
                });
            }

            result.total = airtableData.length;
            console.log(`📋 ${result.total} enregistrements à traiter`);

            if (result.total === 0) {
                console.log('⚠️ Aucun enregistrement à migrer');
                return result;
            }

            // Migrer chaque enregistrement
            for (const record of airtableData) {
                try {
                    const migrationResult = await this.migrateRecord(config, record, options);

                    switch (migrationResult.status) {
                        case 'success':
                            result.success++;
                            break;
                        case 'duplicate':
                            result.duplicates++;
                            break;
                        case 'skipped':
                            result.skipped++;
                            break;
                        case 'error':
                            result.errors++;
                            result.issues.push(migrationResult.message || 'Erreur inconnue');
                            break;
                    }

                } catch (error) {
                    result.errors++;
                    result.issues.push(`Erreur ${record.id}: ${error.message}`);
                }
            }

            // Affichage du résultat
            const successRate = (result.success / result.total) * 100;
            console.log(`📊 Résultats: ${result.success}✅ ${result.errors}❌ ${result.duplicates}🔄 ${result.skipped}⚠️`);
            console.log(`🎯 Taux de réussite: ${successRate.toFixed(1)}%`);

            if (result.issues.length > 0 && result.issues.length <= 5) {
                console.log('⚠️ Problèmes détectés:');
                result.issues.slice(0, 5).forEach(issue => console.log(`   • ${issue}`));
            }

        } catch (error) {
            console.error(`❌ Erreur migration ${config.entity}:`, error);
            result.issues.push(`Erreur globale: ${error.message}`);
        }

        return result;
    }

    private async migrateRecord(config: MigrationConfig, record: any, options: any): Promise<{
        status: 'success' | 'duplicate' | 'skipped' | 'error';
        message?: string;
    }> {

        const airtableId = record.id;

        // Vérifier si déjà migré
        const existing = await this.checkExisting(config.prismaModel, airtableId);
        if (existing) {
            if (options.skipExisting) {
                return { status: 'duplicate', message: 'Déjà migré' };
            }
            // Mettre à jour si pas skipExisting
        }

        // Préparer les données selon l'entité
        let data: any;

        switch (config.entity) {
            case 'Users':
                data = await this.prepareUserData(record);
                break;
            case 'Magasins':
                data = await this.prepareMagasinData(record);
                break;
            case 'Clients':
                data = await this.prepareClientData(record);
                break;
            case 'Chauffeurs':
                data = await this.prepareChauffeurData(record);
                break;
            case 'Commandes':
                data = await this.prepareCommandeData(record);
                break;
            case 'Devis':
                data = await this.prepareDevisData(record);
                break;
            case 'Factures':
                data = await this.prepareFactureData(record);
                break;
            default:
                throw new Error(`Entité non supportée: ${config.entity}`);
        }

        if (!data) {
            return { status: 'skipped', message: 'Données invalides' };
        }

        // Créer l'enregistrement
        await this.createRecord(config.prismaModel, data);

        return { status: 'success' };
    }

    private async checkExisting(model: string, airtableId: string): Promise<boolean> {
        try {
            let existing = null;

            switch (model) {
                case 'user':
                    existing = await prisma.user.findFirst({ where: { airtableId } });
                    break;
                case 'magasin':
                    existing = await prisma.magasin.findFirst({ where: { airtableId } });
                    break;
                case 'client':
                    existing = await prisma.client.findFirst({ where: { airtableId } });
                    break;
                case 'chauffeur':
                    existing = await prisma.chauffeur.findFirst({ where: { airtableId } });
                    break;
                case 'commande':
                    existing = await prisma.commande.findFirst({ where: { airtableId } });
                    break;
            }

            return !!existing;
        } catch {
            return false;
        }
    }

    private async createRecord(model: string, data: any): Promise<void> {
        switch (model) {
            case 'user':
                await prisma.user.create({ data });
                break;
            case 'magasin':
                await prisma.magasin.create({ data });
                break;
            case 'client':
                await prisma.client.create({ data });
                break;
            case 'chauffeur':
                await prisma.chauffeur.create({ data });
                break;
            case 'commande':
                await prisma.commande.create({ data });
                break;
            case 'devis':
                await prisma.devis.create({ data });
                break;
            case 'facture':
                await prisma.facture.create({ data });
                break;
        }
    }

    // Méthodes de préparation des données pour chaque entité
    private async prepareUserData(record: any): Promise<any | null> {
        const fields = record.fields;

        if (!fields['EMAIL']) return null;

        return {
            email: fields['EMAIL'].toLowerCase().trim(),
            nom: fields['NOM'] || '',
            prenom: fields['PRENOM'] || '',
            password: '$2b$10$defaultPasswordHash', // Hash par défaut
            role: this.mapUserRole(fields['ROLE'] || fields['RÔLE']),
            telephone: fields['TELEPHONE'] || null,
            statut: 'ACTIF',
            airtableId: record.id
        };
    }

    private async prepareMagasinData(record: any): Promise<any | null> {
        const fields = record.fields;

        if (!fields['NOM']) return null;

        return {
            nom: fields['NOM'],
            adresse: fields['ADRESSE'] || '',
            telephone: fields['TELEPHONE'] || '',
            email: fields['EMAIL'] || null,
            statut: 'ACTIF',
            airtableId: record.id
        };
    }

    private async prepareClientData(record: any): Promise<any | null> {
        const fields = record.fields;

        if (!fields['NOM'] && !fields['PRENOM']) return null;

        return {
            nom: fields['NOM'] || '',
            prenom: fields['PRENOM'] || '',
            telephone: fields['TELEPHONE'] || fields['TELEPHONE DU CLIENT'] || null,
            email: fields['EMAIL'] || fields['E-MAIL'] || null,
            adresse: fields['ADRESSE'] || '',
            airtableId: record.id
        };
    }

    private async prepareChauffeurData(record: any): Promise<any | null> {
        const fields = record.fields;

        if (!fields['NOM']) return null;

        return {
            nom: fields['NOM'],
            prenom: fields['PRENOM'] || '',
            email: fields['E-MAIL'] || fields['EMAIL'] || null,
            telephone: fields['TELEPHONE'] || null,
            statut: 'ACTIF',
            airtableId: record.id
        };
    }

    private async prepareCommandeData(record: any): Promise<any | null> {
        const fields = record.fields;

        if (!fields['NUMERO DE COMMANDE']) return null;

        // Résoudre les relations
        const magasinId = await this.resolveReference('magasin', fields['Magasins']?.[0]);
        const clientId = await this.resolveReference('client', fields['Clients']?.[0]);

        if (!magasinId || !clientId) return null;

        return {
            numeroCommande: fields['NUMERO DE COMMANDE'],
            dateLivraison: new Date(fields['DATE DE LIVRAISON'] || new Date()),
            clientId,
            magasinId,
            dateCommande: new Date(fields['DATE DE COMMANDE'] || new Date()),
            creneauLivraison: fields['CRENEAU DE LIVRAISON'] || null,
            statutCommande: this.mapStatutCommande(fields['STATUT DE LA COMMANDE']),
            statutLivraison: this.mapStatutLivraison(fields['STATUT DE LA LIVRAISON (ENCART MYTRUCK)']),
            tarifHT: parseFloat(fields['TARIF HT'] || '0'),
            reserveTransport: fields['RESERVE TRANSPORT'] === 'OUI',
            categorieVehicule: fields['CATEGORIE DE VEHICULE'] || null,
            optionEquipier: parseInt(fields['OPTION EQUIPIER DE MANUTENTION'] || '0'),
            prenomVendeur: fields['PRENOM DU VENDEUR/INTERLOCUTEUR'] || null,
            remarques: fields['AUTRES REMARQUES'] || null,
            airtableId: record.id
        };
    }

    private async prepareDevisData(record: any): Promise<any | null> {
        // À implémenter selon le schéma des devis
        return null;
    }

    private async prepareFactureData(record: any): Promise<any | null> {
        // À implémenter selon le schéma des factures
        return null;
    }

    // Méthodes utilitaires
    private async resolveReference(model: string, airtableId: string): Promise<string | null> {
        if (!airtableId) return null;

        try {
            let result = null;

            switch (model) {
                case 'magasin':
                    result = await prisma.magasin.findFirst({
                        where: { airtableId },
                        select: { id: true }
                    });
                    break;
                case 'client':
                    result = await prisma.client.findFirst({
                        where: { airtableId },
                        select: { id: true }
                    });
                    break;
            }

            return result?.id || null;
        } catch {
            return null;
        }
    }

    private mapUserRole(role: any): string {
        if (Array.isArray(role)) role = role[0];
        if (!role) return 'USER';

        const roleStr = role.toString().toLowerCase();
        if (roleStr.includes('admin')) return 'ADMIN';
        if (roleStr.includes('magasin')) return 'MAGASIN';
        if (roleStr.includes('chauffeur')) return 'CHAUFFEUR';
        return 'USER';
    }

    private mapStatutCommande(statuts: any): string {
        if (Array.isArray(statuts)) statuts = statuts[0];
        if (!statuts) return 'En attente';

        const statutMap: Record<string, string> = {
            'En attente': 'En attente',
            'Confirmée': 'Confirmée',
            'Transmise': 'Transmise',
            'Modifiée': 'Modifiée',
            'Annulée': 'Annulée'
        };

        return statutMap[statuts] || 'En attente';
    }

    private mapStatutLivraison(statuts: any): string {
        if (Array.isArray(statuts)) statuts = statuts[0];
        if (!statuts) return 'EN ATTENTE';

        const statutMap: Record<string, string> = {
            'EN ATTENTE': 'EN ATTENTE',
            'CONFIRMEE': 'CONFIRMEE',
            'EN COURS DE LIVRAISON': 'EN COURS',
            'LIVREE': 'LIVREE',
            'ANNULEE': 'ANNULEE',
            'ECHEC': 'ECHEC'
        };

        return statutMap[statuts] || 'EN ATTENTE';
    }

    private async postMigrationValidation(): Promise<void> {
        console.log('\n🔍 Validation post-migration...');

        // Vérifier l'intégrité des relations
        try {
            // Requête corrigée pour PostgreSQL/Prisma
            const totalCommandes = await prisma.commande.count();

            if (totalCommandes > 0) {
                // Vérifier les relations via une requête plus simple
                const commandesWithRelations = await prisma.commande.findMany({
                    select: {
                        id: true,
                        clientId: true,
                        magasinId: true,
                        numeroCommande: true
                    }
                });

                const commandesSansClient = commandesWithRelations.filter(c => !c.clientId).length;
                const commandesSansMagasin = commandesWithRelations.filter(c => !c.magasinId).length;

                if (commandesSansClient > 0) {
                    console.warn(`⚠️ ${commandesSansClient} commandes sans client`);
                }

                if (commandesSansMagasin > 0) {
                    console.warn(`⚠️ ${commandesSansMagasin} commandes sans magasin`);
                }

                if (commandesSansClient === 0 && commandesSansMagasin === 0) {
                    console.log('✅ Toutes les relations sont intègres');
                }
            }

            console.log('✅ Validation post-migration terminée');

        } catch (error) {
            console.error('❌ Erreur validation post-migration:', error);
        }
    }

    private async generateFinalReport(): Promise<void> {
        console.log('\n' + '='.repeat(80));
        console.log('📊 RAPPORT FINAL DE MIGRATION COMPLÈTE');
        console.log('='.repeat(80));

        const duration = this.stats.duration! / 1000;
        console.log(`⏱️ Durée totale: ${duration.toFixed(2)}s`);
        console.log(`📋 Enregistrements traités: ${this.stats.totalProcessed}`);
        console.log(`✅ Succès: ${this.stats.totalSuccess}`);
        console.log(`❌ Erreurs: ${this.stats.totalErrors}`);

        const globalSuccessRate = (this.stats.totalSuccess / this.stats.totalProcessed) * 100;
        console.log(`🎯 Taux de réussite global: ${globalSuccessRate.toFixed(1)}%`);

        console.log('\n📋 Détail par entité:');
        console.log('┌─────────────┬─────────┬─────────┬─────────┬─────────┬──────────┐');
        console.log('│   Entité    │  Total  │ Succès  │ Erreurs │ Doublons│   Taux   │');
        console.log('├─────────────┼─────────┼─────────┼─────────┼─────────┼──────────┤');

        this.stats.entities.forEach(entity => {
            const rate = entity.total > 0 ? (entity.success / entity.total) * 100 : 0;
            const status = rate === 100 ? '✅' : rate >= 80 ? '⚠️' : '❌';

            console.log(`│ ${entity.entity.padEnd(11)} │ ${entity.total.toString().padStart(7)} │ ${entity.success.toString().padStart(7)} │ ${entity.errors.toString().padStart(7)} │ ${entity.duplicates.toString().padStart(8)} │ ${rate.toFixed(1).padStart(6)}% ${status} │`);
        });

        console.log('└─────────────┴─────────┴─────────┴─────────┴─────────┴──────────┘');

        // État final de la base
        console.log('\n🗄️ État final de la base de données:');
        try {
            const counts = await Promise.all([
                prisma.user.count(),
                prisma.magasin.count(),
                prisma.client.count(),
                prisma.chauffeur.count(),
                prisma.commande.count()
            ]);

            console.log(`   👥 Users: ${counts[0]}`);
            console.log(`   🏪 Magasins: ${counts[1]}`);
            console.log(`   👤 Clients: ${counts[2]}`);
            console.log(`   🚛 Chauffeurs: ${counts[3]}`);
            console.log(`   📦 Commandes: ${counts[4]}`);

        } catch (error) {
            console.error('❌ Erreur comptage final:', error);
        }

        if (globalSuccessRate === 100) {
            console.log('\n🎉 MIGRATION PARFAITE - SYSTÈME 100% OPÉRATIONNEL !');
        } else if (globalSuccessRate >= 95) {
            console.log('\n✅ MIGRATION EXCELLENTE - Corrections mineures possibles');
        } else if (globalSuccessRate >= 80) {
            console.log('\n⚠️ MIGRATION BONNE - Quelques corrections nécessaires');
        } else {
            console.log('\n❌ MIGRATION PARTIELLE - Actions correctives requises');
        }

        console.log('='.repeat(80));
    }
}

// Script principal avec options
async function main() {
    const migrator = new CompleteMigrationSystem();

    // Options configurables
    const options = {
        forceRecreate: process.argv.includes('--force'),
        skipExisting: process.argv.includes('--skip-existing'),
        entitiesFilter: process.argv.includes('--entities')
            ? process.argv[process.argv.indexOf('--entities') + 1]?.split(',')
            : undefined
    };

    try {
        console.log('🚀 Démarrage du système de migration complète...\n');

        const stats = await migrator.executeCompleteMigration(options);

        console.log('\n✅ Migration complète terminée !');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Échec de la migration complète:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    main();
}