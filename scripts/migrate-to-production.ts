import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationData {
  magasins: any[];
  users: any[];
  clients: any[];
  chauffeurs: any[];
  commandes: any[];
  slots: any[];
  timestamp: string;
}

class ProductionMigrator {
  private localPrisma: PrismaClient;
  private productionPrisma: PrismaClient;

  constructor() {
    // Base locale (développement)
    this.localPrisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://mytruck_user:MyTruck9194!@localhost:5432/mytruck_db?schema=public"
        }
      }
    });

    // Base de production (Railway)
    this.productionPrisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://postgres:XmgUVedaDmUYCAHokafWVipNvYeIzbqG@postgres.railway.internal:5432/railway"
        }
      }
    });
  }

  async exportData(): Promise<MigrationData> {
    console.log('🔄 Export des données locales...');

    try {
      // Test connexion locale
      await this.localPrisma.user.findMany({ take: 1 });
      console.log('✅ Connexion locale établie');

      const data: MigrationData = {
        timestamp: new Date().toISOString(),
        magasins: [],
        users: [],
        clients: [],
        chauffeurs: [],
        commandes: [],
        slots: []
      };

      // Export magasins avec leurs relations
      console.log('📊 Export des magasins...');
      data.magasins = await this.localPrisma.magasin.findMany({
        include: {
          users: true,
          commandes: {
            include: {
              client: true,
              magasin: true,
              chauffeur: true,
              documents: true
            }
          }
        }
      });
      console.log(`   ✅ ${data.magasins.length} magasins exportés`);

      // Export users système (admins)
      console.log('👥 Export des utilisateurs système...');
      data.users = await this.localPrisma.user.findMany({
        include: {
          magasin: true
        }
      });
      console.log(`   ✅ ${data.users.length} utilisateurs exportés`);

      // Export clients
      console.log('🏢 Export des clients...');
      data.clients = await this.localPrisma.client.findMany({
        include: {
          commandes: true
        }
      });
      console.log(`   ✅ ${data.clients.length} clients exportés`);

      // Export chauffeurs
      console.log('🚚 Export des chauffeurs...');
      data.chauffeurs = await this.localPrisma.chauffeur.findMany({
        include: {
          commandes: true
        }
      });
      console.log(`   ✅ ${data.chauffeurs.length} chauffeurs exportés`);

      // Export créneaux
      console.log('📅 Export des créneaux...');
      data.slots = await this.localPrisma.slot.findMany({
        include: {
          commandes: true
        }
      });
      console.log(`   ✅ ${data.slots.length} créneaux exportés`);

      // Sauvegarder dans un fichier JSON
      const exportPath = path.join(__dirname, '../data', `migration-export-${Date.now()}.json`);
      
      // Créer le dossier s'il n'existe pas
      const dataDir = path.dirname(exportPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
      console.log(`💾 Données sauvegardées: ${exportPath}`);

      return data;

    } catch (error) {
      console.error('❌ Erreur lors de l\'export:', error);
      throw error;
    }
  }

  async importToProduction(data: MigrationData): Promise<void> {
    console.log('🚀 Import vers la production...');

    try {
      // Test connexion production via URL externe (si disponible)
      console.log('🔗 Test connexion production...');
      // Cette partie nécessitera l'URL publique de Railway
      
      console.log('📋 Résumé de l\'import prévu:');
      console.log(`   - ${data.magasins.length} magasins`);
      console.log(`   - ${data.users.length} utilisateurs`);
      console.log(`   - ${data.clients.length} clients`);
      console.log(`   - ${data.chauffeurs.length} chauffeurs`);
      console.log(`   - ${data.slots.length} créneaux`);

      console.log('⚠️  Import vers production nécessite une URL publique Railway');
      console.log('💡 Utilisez plutôt la méthode via API REST pour importer les données');

    } catch (error) {
      console.error('❌ Erreur lors de l\'import:', error);
      throw error;
    }
  }

  async generateImportScript(data: MigrationData): Promise<void> {
    console.log('📜 Génération du script d\'import...');

    let script = `-- Script d'import pour la production Railway\n`;
    script += `-- Généré le: ${data.timestamp}\n\n`;

    // Script pour les magasins
    script += `-- Magasins (${data.magasins.length})\n`;
    for (const magasin of data.magasins) {
      const cleanData = {
        id: magasin.id,
        nom: magasin.nom,
        adresse: magasin.adresse,
        telephone: magasin.telephone,
        email: magasin.email,
        manager: magasin.manager,
        status: magasin.status,
        categories: magasin.categories,
        hasAccount: magasin.hasAccount,
        accountStatus: magasin.accountStatus
      };
      
      script += `INSERT INTO "Magasin" ("id", "nom", "adresse", "telephone", "email", "manager", "status", "categories", "hasAccount", "accountStatus", "createdAt", "updatedAt") VALUES `;
      script += `('${cleanData.id}', '${cleanData.nom.replace(/'/g, "''")}', '${cleanData.adresse?.replace(/'/g, "''") || ""}', '${cleanData.telephone || ""}', '${cleanData.email || ""}', '${cleanData.manager?.replace(/'/g, "''") || ""}', '${cleanData.status}', ARRAY[${cleanData.categories.map(c => `'${c}'`).join(', ')}], ${cleanData.hasAccount}, '${cleanData.accountStatus}', NOW(), NOW());\n`;
    }

    script += `\n-- Clients (${data.clients.length})\n`;
    for (const client of data.clients) {
      script += `INSERT INTO "Client" ("id", "nom", "prenom", "entreprise", "email", "telephone", "adresse", "status", "createdAt", "updatedAt") VALUES `;
      script += `('${client.id}', '${client.nom?.replace(/'/g, "''") || ""}', '${client.prenom?.replace(/'/g, "''") || ""}', '${client.entreprise?.replace(/'/g, "''") || ""}', '${client.email || ""}', '${client.telephone || ""}', '${client.adresse?.replace(/'/g, "''") || ""}', '${client.status}', NOW(), NOW());\n`;
    }

    const scriptPath = path.join(__dirname, '../data', `production-import-${Date.now()}.sql`);
    fs.writeFileSync(scriptPath, script);
    console.log(`📄 Script SQL généré: ${scriptPath}`);
  }

  async disconnect(): Promise<void> {
    await this.localPrisma.$disconnect();
    await this.productionPrisma.$disconnect();
  }
}

// Fonction principale
async function main() {
  const command = process.argv[2];
  const migrator = new ProductionMigrator();

  try {
    switch (command) {
      case 'export':
        console.log('🔄 Démarrage de l\'export des données locales...');
        const data = await migrator.exportData();
        await migrator.generateImportScript(data);
        console.log('✅ Export terminé !');
        break;

      case 'import':
        console.log('⚠️  Import direct non implémenté');
        console.log('💡 Utilisez les endpoints API REST pour importer les données');
        break;

      default:
        console.log('Usage:');
        console.log('  npm run migrate:export  - Exporter les données locales');
        console.log('  npm run migrate:import  - Importer vers production (via API)');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await migrator.disconnect();
  }
}

if (require.main === module) {
  main();
}

export { ProductionMigrator };