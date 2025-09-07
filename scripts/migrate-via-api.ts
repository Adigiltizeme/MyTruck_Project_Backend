import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class APIMigrator {
  private localPrisma: PrismaClient;
  private productionToken: string = '';
  private localToken: string = '';

  constructor() {
    this.localPrisma = new PrismaClient();
  }

  async authenticate(): Promise<void> {
    console.log('🔐 Authentification...');

    // Login local
    try {
      const localAuth = await axios.post(`${LOCAL_URL}/auth/login`, {
        email: 'admin@test.com',
        password: 'admin123'
      });
      this.localToken = localAuth.data.access_token;
      console.log('✅ Connexion locale réussie');
    } catch (error) {
      console.error('❌ Échec connexion locale:', error.response?.data || error.message);
      throw error;
    }

    // Login production
    try {
      const prodAuth = await axios.post(`${PRODUCTION_URL}/auth/login`, {
        email: 'admin@test.com',
        password: 'admin123'
      });
      this.productionToken = prodAuth.data.access_token;
      console.log('✅ Connexion production réussie');
    } catch (error) {
      console.error('❌ Échec connexion production:', error.response?.data || error.message);
      throw error;
    }
  }

  async getLocalData(): Promise<any> {
    console.log('📊 Récupération des données locales...');

    const headers = { Authorization: `Bearer ${this.localToken}` };

    const [magasins, commandes, clients, chauffeurs] = await Promise.all([
      axios.get(`${LOCAL_URL}/magasins`, { headers }),
      axios.get(`${LOCAL_URL}/commandes`, { headers }),
      axios.get(`${LOCAL_URL}/clients`, { headers }),
      axios.get(`${LOCAL_URL}/chauffeurs`, { headers })
    ]);

    const data = {
      magasins: magasins.data.data || [],
      commandes: commandes.data.data || [],
      clients: clients.data.data || [],
      chauffeurs: chauffeurs.data.data || []
    };

    console.log(`   📋 ${data.magasins.length} magasins`);
    console.log(`   📦 ${data.commandes.length} commandes`);
    console.log(`   🏢 ${data.clients.length} clients`);
    console.log(`   🚚 ${data.chauffeurs.length} chauffeurs`);

    return data;
  }

  async migrateMagasins(magasins: any[]): Promise<void> {
    console.log('🏪 Migration des magasins...');
    const headers = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    let success = 0;
    let errors = 0;

    for (const magasin of magasins) {
      try {
        const magasinData = {
          nom: magasin.nom,
          adresse: magasin.adresse,
          telephone: magasin.telephone,
          email: magasin.email,
          manager: magasin.manager,
          status: magasin.status,
          categories: magasin.categories || []
        };

        await axios.post(`${PRODUCTION_URL}/magasins`, magasinData, { headers });
        console.log(`   ✅ ${magasin.nom}`);
        success++;

      } catch (error) {
        console.log(`   ❌ ${magasin.nom}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`📊 Magasins: ${success} réussis, ${errors} erreurs`);
  }

  async migrateClients(clients: any[]): Promise<void> {
    console.log('🏢 Migration des clients...');
    const headers = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    let success = 0;
    let errors = 0;

    for (const client of clients) {
      try {
        const clientData = {
          nom: client.nom,
          prenom: client.prenom,
          entreprise: client.entreprise,
          email: client.email,
          telephone: client.telephone,
          adresse: client.adresse
        };

        await axios.post(`${PRODUCTION_URL}/clients`, clientData, { headers });
        console.log(`   ✅ ${client.nom} ${client.prenom || ''}`);
        success++;

      } catch (error) {
        console.log(`   ❌ ${client.nom}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`📊 Clients: ${success} réussis, ${errors} erreurs`);
  }

  async migrateChauffeurs(chauffeurs: any[]): Promise<void> {
    console.log('🚚 Migration des chauffeurs...');
    const headers = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    let success = 0;
    let errors = 0;

    for (const chauffeur of chauffeurs) {
      try {
        const chauffeurData = {
          nom: chauffeur.nom,
          prenom: chauffeur.prenom,
          telephone: chauffeur.telephone,
          email: chauffeur.email,
          dateNaissance: chauffeur.dateNaissance,
          numeroPermis: chauffeur.numeroPermis
        };

        await axios.post(`${PRODUCTION_URL}/chauffeurs`, chauffeurData, { headers });
        console.log(`   ✅ ${chauffeur.nom} ${chauffeur.prenom || ''}`);
        success++;

      } catch (error) {
        console.log(`   ❌ ${chauffeur.nom}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`📊 Chauffeurs: ${success} réussis, ${errors} erreurs`);
  }

  async checkProductionData(): Promise<void> {
    console.log('🔍 Vérification des données en production...');
    
    const headers = { Authorization: `Bearer ${this.productionToken}` };

    try {
      const [magasins, commandes, clients, chauffeurs] = await Promise.all([
        axios.get(`${PRODUCTION_URL}/magasins`, { headers }),
        axios.get(`${PRODUCTION_URL}/commandes`, { headers }),
        axios.get(`${PRODUCTION_URL}/clients`, { headers }),
        axios.get(`${PRODUCTION_URL}/chauffeurs`, { headers })
      ]);

      console.log('📊 Données en production:');
      console.log(`   🏪 ${magasins.data.meta.total} magasins`);
      console.log(`   📦 ${commandes.data.meta.total} commandes`);
      console.log(`   🏢 ${clients.data.meta.total} clients`);
      console.log(`   🚚 ${chauffeurs.data.meta.total} chauffeurs`);

    } catch (error) {
      console.error('❌ Erreur vérification:', error.response?.data || error.message);
    }
  }

  async fullMigration(): Promise<void> {
    try {
      await this.authenticate();
      
      console.log('\n📋 Vérification données production AVANT migration:');
      await this.checkProductionData();
      
      const localData = await this.getLocalData();

      console.log('\n🚀 Début de la migration...');
      
      // Migration dans l'ordre des dépendances
      await this.migrateMagasins(localData.magasins);
      await this.migrateClients(localData.clients);
      await this.migrateChauffeurs(localData.chauffeurs);
      
      console.log('\n📋 Vérification données production APRÈS migration:');
      await this.checkProductionData();
      
      console.log('\n✅ Migration terminée !');

    } catch (error) {
      console.error('❌ Erreur pendant la migration:', error);
      throw error;
    }
  }
}

// Fonction principale
async function main() {
  const command = process.argv[2];
  const migrator = new APIMigrator();

  try {
    switch (command) {
      case 'check':
        await migrator.authenticate();
        await migrator.checkProductionData();
        break;

      case 'migrate':
        await migrator.fullMigration();
        break;

      default:
        console.log('Usage:');
        console.log('  npm run migrate:check   - Vérifier les données en production');
        console.log('  npm run migrate:api     - Migrer toutes les données via API');
        break;
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { APIMigrator };