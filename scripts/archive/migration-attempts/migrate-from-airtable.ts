// scripts/migrate-from-airtable.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';

interface MigrationStats {
    table: string;
    imported: number;
    errors: number;
    skipped: number;
    details: string[];
}

class PostgresMigrator {
    private prisma: PrismaClient;
    private dataDir: string;

    constructor() {
        this.prisma = new PrismaClient();
        this.dataDir = path.join(__dirname, '../data/airtable-export');

        console.log('🔧 Initialisé avec:');
        console.log(`   📁 Dossier de données: ${this.dataDir}`);
        console.log(`   🗄️  Base de données: ${process.env.DATABASE_URL?.split('@')[1] || 'localhost'}`);
    }

    private readJsonFile(filename: string): any[] {
        const filepath = path.join(this.dataDir, filename);

        if (!fs.existsSync(filepath)) {
            console.log(`⚠️  Fichier non trouvé: ${filename}`);
            return [];
        }

        try {
            const content = fs.readFileSync(filepath, 'utf8');
            const data = JSON.parse(content);
            console.log(`📄 Lu ${filename}: ${data.length} enregistrements`);
            return data;
        } catch (error) {
            console.error(`❌ Erreur lecture ${filename}:`, error.message);
            return [];
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            console.log('🔌 Test de connexion à la base de données...');
            await this.prisma.$connect();

            // Test simple
            await this.prisma.$queryRaw`SELECT 1 as test`;
            console.log('✅ Connexion à PostgreSQL réussie');
            return true;
        } catch (error) {
            console.error('❌ Erreur de connexion PostgreSQL:', error.message);
            return false;
        }
    }

    async migrateMagasins(): Promise<MigrationStats> {
        console.log('\n📍 === MIGRATION DES MAGASINS ===');

        const data = this.readJsonFile('Magasins.json');
        const stats: MigrationStats = {
            table: 'Magasins',
            imported: 0,
            errors: 0,
            skipped: 0,
            details: []
        };

        if (data.length === 0) {
            console.log('⚠️  Aucune donnée de magasin trouvée');
            return stats;
        }

        for (const [index, record] of data.entries()) {
            let fields: any;
            try {
                fields = record.fields;

                console.log(`📋 [${index + 1}/${data.length}] Migration magasin: ${fields['NOM DU MAGASIN'] || 'Sans nom'}`);

                const magasin = await this.prisma.magasin.upsert({
                    where: { airtableId: record.id },
                    update: {
                        nom: fields['NOM DU MAGASIN'] || 'Magasin sans nom',
                        adresse: fields['ADRESSE DU MAGASIN'] || 'Adresse non renseignée',
                        telephone: fields['TÉLÉPHONE'] || null,
                        email: fields['E-MAIL'] || null,
                        status: fields['STATUT'] || 'Actif',
                        categories: this.parseCategories(fields['CATEGORIE']),
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        airtableId: record.id,
                        nom: fields['NOM DU MAGASIN'] || 'Magasin sans nom',
                        adresse: fields['ADRESSE DU MAGASIN'] || 'Adresse non renseignée',
                        telephone: fields['TÉLÉPHONE'] || null,
                        email: fields['E-MAIL'] || null,
                        status: fields['STATUT'] || 'Actif',
                        categories: this.parseCategories(fields['CATEGORIE']),
                        lastSyncedAt: new Date(),
                    },
                });

                stats.imported++;
                stats.details.push(`✅ ${magasin.nom} (${magasin.id})`);

            } catch (error) {
                console.error(`❌ Erreur migration magasin ${record.id}:`, error.message);
                stats.errors++;
                const nom = fields && fields['NOM DU MAGASIN'] ? fields['NOM DU MAGASIN'] : record.id;
                stats.details.push(`❌ ${nom}: ${error.message}`);
            }
        }

        return stats;
    }

    async migratePersonnel(): Promise<MigrationStats> {
        console.log('\n👥 === MIGRATION DU PERSONNEL ===');

        const data = this.readJsonFile('Personnel_My_Truck.json');
        const stats: MigrationStats = {
            table: 'Personnel',
            imported: 0,
            errors: 0,
            skipped: 0,
            details: []
        };

        if (data.length === 0) {
            console.log('⚠️  Aucune donnée de personnel trouvée');
            return stats;
        }

        for (const [index, record] of data.entries()) {
            let fields: any;
            try {
                fields = record.fields;
                const roles = this.parseRoles(fields['RÔLE']);

                console.log(`👤 [${index + 1}/${data.length}] Migration personnel: ${fields['NOM']} ${fields['PRENOM'] || ''}`);

                // Créer le chauffeur si le rôle contient "Chauffeur"
                if (roles.includes('Chauffeur') || roles.includes('chauffeur')) {
                    const chauffeur = await this.prisma.chauffeur.upsert({
                        where: { airtableId: record.id },
                        update: {
                            nom: fields['NOM'] || 'Nom inconnu',
                            prenom: fields['PRENOM'] || '',
                            telephone: fields['TELEPHONE'] || null,
                            email: fields['E-MAIL'] || null,
                            status: fields['STATUT'] || 'Actif',
                            longitude: this.parseFloat(fields['LONGITUDE']),
                            latitude: this.parseFloat(fields['LATITUDE']),
                            notes: this.parseInt(fields['NOTES']) || null,
                            lastSyncedAt: new Date(),
                        },
                        create: {
                            airtableId: record.id,
                            nom: fields['NOM'] || 'Nom inconnu',
                            prenom: fields['PRENOM'] || '',
                            telephone: fields['TELEPHONE'] || null,
                            email: fields['E-MAIL'] || null,
                            status: fields['STATUT'] || 'Actif',
                            longitude: this.parseFloat(fields['LONGITUDE']),
                            latitude: this.parseFloat(fields['LATITUDE']),
                            notes: this.parseInt(fields['NOTES']) || null,
                            lastSyncedAt: new Date(),
                        },
                    });

                    stats.imported++;
                    stats.details.push(`✅ Chauffeur: ${chauffeur.nom} ${chauffeur.prenom}`);
                } else {
                    stats.skipped++;
                    stats.details.push(`⏭️  Non-chauffeur: ${fields['NOM']} (${roles.join(', ')})`);
                }

            } catch (error) {
                console.error(`❌ Erreur migration personnel ${record.id}:`, error.message);
                stats.errors++;
                const nom = fields && fields['NOM'] ? fields['NOM'] : record.id;
                stats.details.push(`❌ ${nom}: ${error.message}`);
            }
        }

        return stats;
    }

    async migrateUsers(): Promise<MigrationStats> {
        console.log('\n👤 === MIGRATION DES USERS ===');

        const data = this.readJsonFile('Users.json');
        const stats: MigrationStats = {
            table: 'Users',
            imported: 0,
            errors: 0,
            skipped: 0,
            details: []
        };

        if (data.length === 0) {
            console.log('⚠️  Aucune donnée d\'utilisateur trouvée');
            return stats;
        }

        for (const [index, record] of data.entries()) {
            let fields: any;
            try {
                fields = record.fields;

                console.log(`🔐 [${index + 1}/${data.length}] Migration user: ${fields['E-MAIL'] || 'Sans email'}`);

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

                const user = await this.prisma.user.upsert({
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
                stats.details.push(`✅ ${user.email} (${role})`);

            } catch (error) {
                console.error(`❌ Erreur migration user ${record.id}:`, error.message);
                stats.errors++;
                stats.details.push(`❌ ${(fields && fields['E-MAIL']) || record.id}: ${error.message}`);
            }
        }

        return stats;
    }

    async migrateClients(): Promise<MigrationStats> {
        console.log('\n🏠 === MIGRATION DES CLIENTS ===');

        const data = this.readJsonFile('Clients.json');
        const stats: MigrationStats = {
            table: 'Clients',
            imported: 0,
            errors: 0,
            skipped: 0,
            details: []
        };

        if (data.length === 0) {
            console.log('⚠️  Aucune donnée de client trouvée');
            return stats;
        }

        for (const [index, record] of data.entries()) {
            let fields: any;
            try {
                fields = record.fields;

                console.log(`🏠 [${index + 1}/${data.length}] Migration client: ${fields['NOM DU CLIENT']} ${fields['PRENOM DU CLIENT'] || ''}`);

                const client = await this.prisma.client.upsert({
                    where: { airtableId: record.id },
                    update: {
                        nom: fields['NOM DU CLIENT'] || 'Nom inconnu',
                        prenom: fields['PRENOM DU CLIENT'] || null,
                        telephone: fields['TÉLÉPHONE'] || null,
                        telephoneSecondaire: fields['TÉLÉPHONE SECONDAIRE'] || null,
                        adresseLigne1: fields['ADRESSE DE LIVRAISON'] || 'Adresse non renseignée',
                        batiment: fields['BATIMENT'] || null,
                        etage: fields['ÉTAGE'] || null,
                        interphone: fields['INTERPHONE'] || null,
                        ascenseur: fields['ASCENSEUR'] === 'Oui' || false,
                        typeAdresse: fields['TYPE D\'ADRESSE'] || null,
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        airtableId: record.id,
                        nom: fields['NOM DU CLIENT'] || 'Nom inconnu',
                        prenom: fields['PRENOM DU CLIENT'] || null,
                        telephone: fields['TÉLÉPHONE'] || null,
                        telephoneSecondaire: fields['TÉLÉPHONE SECONDAIRE'] || null,
                        adresseLigne1: fields['ADRESSE DE LIVRAISON'] || 'Adresse non renseignée',
                        batiment: fields['BATIMENT'] || null,
                        etage: fields['ÉTAGE'] || null,
                        interphone: fields['INTERPHONE'] || null,
                        ascenseur: fields['ASCENSEUR'] === 'Oui' || false,
                        typeAdresse: fields['TYPE D\'ADRESSE'] || null,
                        lastSyncedAt: new Date(),
                    },
                });

                stats.imported++;
                stats.details.push(`✅ ${client.nom} ${client.prenom || ''} (${client.id})`);

            } catch (error) {
                console.error(`❌ Erreur migration client ${record.id}:`, error.message);
                stats.errors++;
                const nom = fields && fields['NOM DU CLIENT'] ? fields['NOM DU CLIENT'] : record.id;
                stats.details.push(`❌ ${nom}: ${error.message}`);
            }
        }

        return stats;
    }

    async migrateCommandes(): Promise<MigrationStats> {
        console.log('\n📦 === MIGRATION DES COMMANDES ===');

        const data = this.readJsonFile('Commandes.json');
        const stats: MigrationStats = {
            table: 'Commandes',
            imported: 0,
            errors: 0,
            skipped: 0,
            details: []
        };

        if (data.length === 0) {
            console.log('⚠️  Aucune donnée de commande trouvée');
            return stats;
        }

        // Créer les mappings Airtable ID → PostgreSQL ID
        const magasinsMap = await this.createMagasinsMap();
        const clientsMap = await this.createClientsMap();
        const chauffeursMap = await this.createChauffeursMap();

        console.log(`🗺️  Mappings créés: ${Object.keys(magasinsMap).length} magasins, ${Object.keys(clientsMap).length} clients, ${Object.keys(chauffeursMap).length} chauffeurs`);

        for (const [index, record] of data.entries()) {
            let fields: any;
            try {
                fields = record.fields;

                console.log(`📦 [${index + 1}/${data.length}] Migration commande: ${fields['NUMERO DE COMMANDE'] || 'Sans numéro'}`);

                // Résoudre les relations
                const magasinId = this.resolveRelation(fields['ENTREPRISE/MAGASIN'], magasinsMap, 'magasin');
                const clientInfo = this.resolveClientRelation(fields, clientsMap);

                if (!magasinId) {
                    console.log(`⚠️  Commande ${fields['NUMERO DE COMMANDE'] || record.id} ignorée: magasin non trouvé`);
                    console.log(`   🔍 Magasin Airtable ID: ${JSON.stringify(fields['ENTREPRISE/MAGASIN'])}`);
                    stats.skipped++;
                    stats.details.push(`⏭️  ${fields['NUMERO DE COMMANDE']}: magasin non trouvé`);
                    continue;
                }

                if (!clientInfo.clientId) {
                    // Créer le client s'il n'existe pas
                    const newClient = await this.createClientFromCommande(fields);
                    clientInfo.clientId = newClient.id;
                    console.log(`🆕 Client créé pour la commande: ${newClient.nom}`);
                }

                // Créer la commande
                const commande = await this.prisma.commande.upsert({
                    where: { airtableId: record.id },
                    update: {
                        numeroCommande: fields['NUMERO DE COMMANDE'] || `CMD${Date.now()}`,
                        dateCommande: this.parseDate(fields['DATE DE COMMANDE']) || new Date(),
                        dateLivraison: this.parseDate(fields['DATE DE LIVRAISON']) || new Date(),
                        creneauLivraison: fields['CRENEAU DE LIVRAISON'] || null,
                        statutCommande: this.mapStatutCommande(fields['STATUT DE LA COMMANDE']),
                        statutLivraison: this.mapStatutLivraison(fields['STATUT DE LA LIVRAISON']),
                        categorieVehicule: fields['CATEGORIE DE VEHICULE'] || null,
                        optionEquipier: this.parseInt(fields['OPTION EQUIPIER']) || 0,
                        tarifHT: this.parseFloat(fields['TARIF HT']) || 0,
                        reserveTransport: fields['RESERVE TRANSPORT'] === 'Oui' || false,
                        prenomVendeur: fields['PRENOM VENDEUR'] || null,
                        clientId: clientInfo.clientId,
                        magasinId: magasinId,
                        lastSyncedAt: new Date(),
                    },
                    create: {
                        airtableId: record.id,
                        numeroCommande: fields['NUMERO DE COMMANDE'] || `CMD${Date.now()}`,
                        dateCommande: this.parseDate(fields['DATE DE COMMANDE']) || new Date(),
                        dateLivraison: this.parseDate(fields['DATE DE LIVRAISON']) || new Date(),
                        creneauLivraison: fields['CRENEAU DE LIVRAISON'] || null,
                        statutCommande: this.mapStatutCommande(fields['STATUT DE LA COMMANDE']),
                        statutLivraison: this.mapStatutLivraison(fields['STATUT DE LA LIVRAISON']),
                        categorieVehicule: fields['CATEGORIE DE VEHICULE'] || null,
                        optionEquipier: this.parseInt(fields['OPTION EQUIPIER']) || 0,
                        tarifHT: this.parseFloat(fields['TARIF HT']) || 0,
                        reserveTransport: fields['RESERVE TRANSPORT'] === 'Oui' || false,
                        prenomVendeur: fields['PRENOM VENDEUR'] || null,
                        clientId: clientInfo.clientId,
                        magasinId: magasinId,
                        lastSyncedAt: new Date(),
                    },
                });

                // Créer les articles associés
                if (fields['NOMBRE D\'ARTICLES'] || fields['DETAILS DES ARTICLES']) {
                    // Try to find an existing article for this commande
                    const existingArticle = await this.prisma.article.findFirst({
                        where: { commandeId: commande.id },
                        select: { id: true }
                    });

                    await this.prisma.article.upsert({
                        where: existingArticle ? { id: existingArticle.id } : { id: '' }, // If not found, upsert will create
                        update: {
                            nombre: this.parseInt(fields['NOMBRE D\'ARTICLES']) || 1,
                            details: fields['DETAILS DES ARTICLES'] || null,
                            categories: this.parseCategories(fields['CATEGORIES D\'ARTICLES']),
                        },
                        create: {
                            nombre: this.parseInt(fields['NOMBRE D\'ARTICLES']) || 1,
                            details: fields['DETAILS DES ARTICLES'] || null,
                            categories: this.parseCategories(fields['CATEGORIES D\'ARTICLES']),
                            commandeId: commande.id,
                        },
                    });
                }

                // Assigner les chauffeurs
                await this.assignChauffeurs(commande.id, fields['CHAUFFEURS'], chauffeursMap);

                stats.imported++;
                stats.details.push(`✅ ${commande.numeroCommande} → ${clientInfo.clientNom} (${magasinId.substring(0, 8)}...)`);

            } catch (error) {
                console.error(`❌ Erreur migration commande ${record.id}:`, error.message);
                stats.errors++;
                stats.details.push(`❌ ${fields['NUMERO DE COMMANDE'] || record.id}: ${error.message}`);
            }
        }

        return stats;
    }

    // Méthodes utilitaires pour les relations
    private async createMagasinsMap(): Promise<{ [key: string]: string }> {
        const magasins = await this.prisma.magasin.findMany({
            select: { id: true, airtableId: true }
        });

        const map: { [key: string]: string } = {};
        magasins.forEach(magasin => {
            if (magasin.airtableId) {
                map[magasin.airtableId] = magasin.id;
            }
        });

        return map;
    }

    private async createClientsMap(): Promise<{ [key: string]: string }> {
        const clients = await this.prisma.client.findMany({
            select: { id: true, airtableId: true, nom: true, prenom: true }
        });

        const map: { [key: string]: string } = {};
        clients.forEach(client => {
            if (client.airtableId) {
                map[client.airtableId] = client.id;
            }
            // Créer aussi un mapping par nom complet pour les clients sans airtableId
            const fullName = `${client.nom} ${client.prenom || ''}`.trim();
            map[fullName] = client.id;
        });

        return map;
    }

    private async createChauffeursMap(): Promise<{ [key: string]: string }> {
        const chauffeurs = await this.prisma.chauffeur.findMany({
            select: { id: true, airtableId: true, nom: true, prenom: true }
        });

        const map: { [key: string]: string } = {};
        chauffeurs.forEach(chauffeur => {
            if (chauffeur.airtableId) {
                map[chauffeur.airtableId] = chauffeur.id;
            }
            // Mapping par nom aussi
            const fullName = `${chauffeur.nom} ${chauffeur.prenom || ''}`.trim();
            map[fullName] = chauffeur.id;
        });

        return map;
    }

    private resolveRelation(airtableField: any, map: { [key: string]: string }, entityType: string): string | null {
        if (!airtableField) return null;

        // Si c'est un tableau (relations multiples), prendre le premier
        if (Array.isArray(airtableField)) {
            for (const id of airtableField) {
                if (map[id]) {
                    return map[id];
                }
            }
        }

        // Si c'est une chaîne directe
        if (typeof airtableField === 'string' && map[airtableField]) {
            return map[airtableField];
        }

        console.log(`🔍 Relation ${entityType} non résolue:`, airtableField);
        return null;
    }

    private resolveClientRelation(fields: any, clientsMap: { [key: string]: string }): { clientId: string | null, clientNom: string } {
        // Essayer d'abord avec l'ID Airtable
        if (fields['CLIENT'] && Array.isArray(fields['CLIENT'])) {
            for (const clientId of fields['CLIENT']) {
                if (clientsMap[clientId]) {
                    return { clientId: clientsMap[clientId], clientNom: 'Client trouvé' };
                }
            }
        }

        // Essayer avec le nom du client
        const nomClient = fields['NOM DU CLIENT'];
        const prenomClient = fields['PRENOM DU CLIENT'];

        if (nomClient) {
            const fullName = `${nomClient} ${prenomClient || ''}`.trim();
            if (clientsMap[fullName]) {
                return { clientId: clientsMap[fullName], clientNom: fullName };
            }

            // Essayer juste le nom
            if (clientsMap[nomClient]) {
                return { clientId: clientsMap[nomClient], clientNom: nomClient };
            }
        }

        return { clientId: null, clientNom: nomClient || 'Client inconnu' };
    }

    private async createClientFromCommande(fields: any): Promise<any> {
        const clientData = {
            nom: fields['NOM DU CLIENT'] || 'Client inconnu',
            prenom: fields['PRENOM DU CLIENT'] || null,
            telephone: fields['TELEPHONE DU CLIENT'] || null,
            telephoneSecondaire: fields['TELEPHONE SECONDAIRE DU CLIENT'] || null,
            adresseLigne1: fields['ADRESSE DE LIVRAISON'] || 'Adresse non renseignée',
            ville: fields['VILLE DU CLIENT'] || null,
            batiment: fields['BATIMENT'] || null,
            etage: fields['ETAGE'] || null,
            interphone: fields['INTERPHONE'] || null,
            ascenseur: fields['ASCENSEUR'] === 'Oui' || false,
            typeAdresse: fields['TYPE D\'ADRESSE'] || null,
        };

        return await this.prisma.client.create({
            data: clientData,
        });
    }

    private async assignChauffeurs(commandeId: string, chauffeursField: any, chauffeursMap: { [key: string]: string }): Promise<void> {
        if (!chauffeursField) return;

        const chauffeurIds: string[] = [];

        if (Array.isArray(chauffeursField)) {
            for (const chauffeurRef of chauffeursField) {
                const chauffeurId = chauffeursMap[chauffeurRef];
                if (chauffeurId) {
                    chauffeurIds.push(chauffeurId);
                }
            }
        }

        // Créer les assignations
        for (const chauffeurId of chauffeurIds) {
            try {
                await this.prisma.chauffeurSurCommande.upsert({
                    where: {
                        chauffeurId_commandeId: {
                            chauffeurId: chauffeurId,
                            commandeId: commandeId,
                        },
                    },
                    update: {},
                    create: {
                        chauffeurId: chauffeurId,
                        commandeId: commandeId,
                    },
                });
            } catch (error) {
                console.warn(`⚠️  Erreur assignation chauffeur ${chauffeurId}:`, error.message);
            }
        }
    }

    // Méthodes de mapping des statuts
    private mapStatutCommande(statut: any): string {
        const mapping: { [key: string]: string } = {
            'En attente': 'En attente',
            'Confirmée': 'Confirmée',
            'Annulée': 'Annulée',
            'Modifiée': 'Modifiée',
            'Transmise': 'Transmise',
        };

        return mapping[statut] || 'En attente';
    }

    private mapStatutLivraison(statut: any): string {
        const mapping: { [key: string]: string } = {
            'EN ATTENTE': 'EN ATTENTE',
            'CONFIRMEE': 'CONFIRMEE',
            'EN COURS': 'EN COURS',
            'EN COURS DE LIVRAISON': 'EN COURS',
            'LIVREE': 'LIVREE',
            'ECHEC': 'ECHEC',
            'ANNULEE': 'ANNULEE',
        };

        return mapping[statut] || 'EN ATTENTE';
    }

    private parseDate(dateStr: any): Date | null {
        if (!dateStr) return null;

        try {
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        } catch (error) {
            return null;
        }
    }

    async migrateAll(): Promise<void> {
        console.log('🚀 === DÉBUT DE LA MIGRATION VERS POSTGRESQL ===\n');

        try {
            // Test de connexion
            const isConnected = await this.testConnection();
            if (!isConnected) {
                console.error('❌ Impossible de se connecter à PostgreSQL. Vérifiez DATABASE_URL');
                return;
            }

            const results: MigrationStats[] = [];

            // Migration dans l'ordre des dépendances
            console.log('📋 Ordre de migration: Magasins → Personnel → Users → Clients → Commandes');

            results.push(await this.migrateMagasins());
            results.push(await this.migratePersonnel());
            results.push(await this.migrateUsers());
            results.push(await this.migrateClients());
            results.push(await this.migrateCommandes());

            // Résumé final
            console.log('\n' + '='.repeat(60));
            console.log('📊 RÉSUMÉ DE LA MIGRATION');
            console.log('='.repeat(60));

            results.forEach(stat => {
                console.log(`\n📋 ${stat.table}:`);
                console.log(`   ✅ Importés: ${stat.imported}`);
                console.log(`   ❌ Erreurs: ${stat.errors}`);
                console.log(`   ⏭️  Ignorés: ${stat.skipped}`);

                if (stat.details.length > 0 && stat.details.length <= 10) {
                    stat.details.forEach(detail => console.log(`   ${detail}`));
                } else if (stat.details.length > 10) {
                    console.log(`   📝 ${stat.details.length} détails (trop nombreux pour affichage)`);
                }
            });

            const totalImported = results.reduce((sum, stat) => sum + stat.imported, 0);
            const totalErrors = results.reduce((sum, stat) => sum + stat.errors, 0);
            const totalSkipped = results.reduce((sum, stat) => sum + stat.skipped, 0);

            console.log('\n' + '='.repeat(60));
            console.log(`🎯 TOTAL: ${totalImported} importés, ${totalErrors} erreurs, ${totalSkipped} ignorés`);

            if (totalErrors === 0) {
                console.log('🎉 MIGRATION RÉUSSIE ! Toutes les données ont été migrées.');
            } else {
                console.log(`⚠️  Migration terminée avec ${totalErrors} erreurs.`);
            }

        } catch (error) {
            console.error('❌ Erreur générale de migration:', error);
        } finally {
            await this.prisma.$disconnect();
            console.log('🔌 Connexion fermée');
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

    private parseFloat(value: any): number | null {
        if (value === null || value === undefined || value === '') return null;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }

    private parseInt(value: any): number | null {
        if (value === null || value === undefined || value === '') return null;
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
    }

    private mapUserRole(airtableRole: any): any {
        const roleMapping: { [key: string]: string } = {
            'Direction My Truck': 'DIRECTION',
            'Chauffeur': 'CHAUFFEUR',
            'Interlocuteur Truffaut Ivry': 'MAGASIN',
            'Section IT': 'ADMIN',
            'Admin': 'ADMIN',
        };

        if (Array.isArray(airtableRole)) {
            // Prendre le premier rôle mappé trouvé
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
    console.log('🔧 Script de migration Airtable → PostgreSQL');
    console.log('📅 Démarré le:', new Date().toLocaleString());

    const migrator = new PostgresMigrator();
    await migrator.migrateAll();
}

if (require.main === module) {
    main().catch(error => {
        console.error('💥 Erreur fatale:', error);
        process.exit(1);
    });
}