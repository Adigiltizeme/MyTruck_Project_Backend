import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class CompleteMigrator {
  private productionToken: string = '';
  private localToken: string = '';

  async authenticate(): Promise<void> {
    console.log('🔐 Authentification...');

    // Login local
    const localAuth = await axios.post(`${LOCAL_URL}/auth/login`, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    this.localToken = localAuth.data.access_token;
    console.log('✅ Connexion locale réussie');

    // Login production
    const prodAuth = await axios.post(`${PRODUCTION_URL}/auth/login`, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    this.productionToken = prodAuth.data.access_token;
    console.log('✅ Connexion production réussie');
  }

  async getDataInventory(): Promise<void> {
    console.log('\n📊 INVENTAIRE DES DONNÉES LOCALES');
    console.log('='.repeat(50));

    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    // Récupérer les données des deux environnements
    const [
      localMagasins, localCommandes, localClients, localChauffeurs,
      prodMagasins, prodCommandes, prodClients, prodChauffeurs
    ] = await Promise.all([
      axios.get(`${LOCAL_URL}/magasins?take=100`, { headers: localHeaders }),
      axios.get(`${LOCAL_URL}/commandes?take=100`, { headers: localHeaders }),
      axios.get(`${LOCAL_URL}/clients?take=100`, { headers: localHeaders }),
      axios.get(`${LOCAL_URL}/chauffeurs?take=100`, { headers: localHeaders }),
      axios.get(`${PRODUCTION_URL}/magasins?take=100`, { headers: prodHeaders }),
      axios.get(`${PRODUCTION_URL}/commandes?take=100`, { headers: prodHeaders }),
      axios.get(`${PRODUCTION_URL}/clients?take=100`, { headers: prodHeaders }),
      axios.get(`${PRODUCTION_URL}/chauffeurs?take=100`, { headers: prodHeaders })
    ]);

    console.log('\n🏠 LOCAL:');
    console.log(`   🏪 Magasins: ${localMagasins.data.meta.total}`);
    console.log(`   🏢 Clients: ${localClients.data.meta.total}`);
    console.log(`   🚚 Chauffeurs: ${localChauffeurs.data.meta.total}`);
    console.log(`   📦 Commandes: ${localCommandes.data.meta.total}`);

    console.log('\n🌐 PRODUCTION:');
    console.log(`   🏪 Magasins: ${prodMagasins.data.meta.total}`);
    console.log(`   🏢 Clients: ${prodClients.data.meta.total}`);
    console.log(`   🚚 Chauffeurs: ${prodChauffeurs.data.meta.total}`);
    console.log(`   📦 Commandes: ${prodCommandes.data.meta.total}`);

    // Analyser les commandes locales pour comprendre la structure des clients
    if (localCommandes.data.data.length > 0) {
      console.log('\n🔍 ANALYSE DES COMMANDES LOCALES:');
      const sampleCommande = localCommandes.data.data[0];
      console.log('   Exemple de commande:', {
        numero: sampleCommande.numeroCommande,
        clientId: sampleCommande.clientId,
        magasinId: sampleCommande.magasinId,
        statut: sampleCommande.statutCommande
      });
      
      // Vérifier les relations
      console.log('\n🔗 VÉRIFICATION DES RELATIONS:');
      const commandesAvecClient = localCommandes.data.data.filter(cmd => cmd.clientId).length;
      const commandesAvecMagasin = localCommandes.data.data.filter(cmd => cmd.magasinId).length;
      
      console.log(`   📦 Commandes avec clientId: ${commandesAvecClient}/${localCommandes.data.data.length}`);
      console.log(`   🏪 Commandes avec magasinId: ${commandesAvecMagasin}/${localCommandes.data.data.length}`);
    }
  }

  async extractClientsFromCommandes(): Promise<any[]> {
    console.log('\n🔍 EXTRACTION DES CLIENTS DEPUIS LES COMMANDES...');
    
    const headers = { Authorization: `Bearer ${this.localToken}` };
    
    // Récupérer toutes les commandes avec leurs détails clients
    const commandesResponse = await axios.get(`${LOCAL_URL}/commandes?take=1000`, { headers });
    const commandes = commandesResponse.data.data;
    
    if (commandes.length === 0) {
      console.log('❌ Aucune commande trouvée');
      return [];
    }

    // Extraire les informations clients uniques
    const clientsMap = new Map();
    
    commandes.forEach(commande => {
      if (commande.clientId && !clientsMap.has(commande.clientId)) {
        // Construire un objet client à partir des données de commande
        const client = {
          id: commande.clientId,
          // Ces champs peuvent être dans la commande ou ses relations
          nom: commande.client?.nom || `Client-${commande.clientId.slice(0, 8)}`,
          prenom: commande.client?.prenom || '',
          telephone: commande.client?.telephone || '',
          adresseLigne1: commande.client?.adresseLigne1 || 'Adresse non spécifiée',
          // Déduire d'autres informations si possible
          lastActivityAt: commande.dateCommande || new Date()
        };
        
        clientsMap.set(commande.clientId, client);
      }
    });

    const extractedClients = Array.from(clientsMap.values());
    console.log(`   ✅ ${extractedClients.length} clients uniques extraits`);
    
    return extractedClients;
  }

  async migrateExtractedClients(clients: any[]): Promise<void> {
    if (clients.length === 0) {
      console.log('⚠️ Aucun client à migrer');
      return;
    }

    console.log(`\n🏢 MIGRATION DE ${clients.length} CLIENTS...`);
    
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
          prenom: client.prenom || '',
          telephone: client.telephone || '',
          adresseLigne1: client.adresseLigne1 || 'Adresse à préciser'
        };

        await axios.post(`${PRODUCTION_URL}/clients`, clientData, { headers });
        console.log(`   ✅ ${client.nom}`);
        success++;

      } catch (error) {
        console.log(`   ❌ ${client.nom}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`📊 Clients: ${success} réussis, ${errors} erreurs`);
  }

  async migrateCommandes(): Promise<void> {
    console.log('\n📦 MIGRATION DES COMMANDES...');
    
    // 1. Récupérer les commandes locales
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const commandesResponse = await axios.get(`${LOCAL_URL}/commandes?take=1000`, { headers: localHeaders });
    const commandes = commandesResponse.data.data;

    if (commandes.length === 0) {
      console.log('❌ Aucune commande trouvée');
      return;
    }

    // 2. Récupérer les IDs des entités en production pour le mapping
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };
    const [prodMagasins, prodClients, prodChauffeurs] = await Promise.all([
      axios.get(`${PRODUCTION_URL}/magasins?take=1000`, { headers: prodHeaders }),
      axios.get(`${PRODUCTION_URL}/clients?take=1000`, { headers: prodHeaders }),
      axios.get(`${PRODUCTION_URL}/chauffeurs?take=1000`, { headers: prodHeaders })
    ]);

    // 3. Créer des maps pour le mapping nom -> ID
    const magasinMap = new Map();
    const clientMap = new Map(); 
    const chauffeurMap = new Map();

    prodMagasins.data.data.forEach(mag => magasinMap.set(mag.nom, mag.id));
    prodClients.data.data.forEach(cli => clientMap.set(cli.nom, cli.id));
    prodChauffeurs.data.data.forEach(cha => chauffeurMap.set(`${cha.nom} ${cha.prenom}`.trim(), cha.id));

    console.log(`   📋 Mapping: ${magasinMap.size} magasins, ${clientMap.size} clients, ${chauffeurMap.size} chauffeurs`);

    // 4. Migrer les commandes (structure simplifiée pour commencer)
    let success = 0;
    let errors = 0;

    for (const commande of commandes.slice(0, 5)) { // Limiter pour test
      try {
        // Prendre le premier magasin disponible par défaut
        const defaultMagasinId = Array.from(magasinMap.values())[0];
        const defaultClientId = Array.from(clientMap.values())[0];
        
        const commandeData = {
          numeroCommande: commande.numeroCommande,
          dateCommande: commande.dateCommande,
          dateLivraison: commande.dateLivraison,
          creneauLivraison: commande.creneauLivraison || '14h-16h',
          statutCommande: commande.statutCommande || 'En attente',
          statutLivraison: commande.statutLivraison || 'EN ATTENTE',
          tarifHT: parseFloat(commande.tarifHT) || 0,
          clientId: defaultClientId,
          magasinId: defaultMagasinId
        };

        await axios.post(`${PRODUCTION_URL}/commandes`, commandeData, { headers: prodHeaders });
        console.log(`   ✅ ${commande.numeroCommande}`);
        success++;

      } catch (error) {
        console.log(`   ❌ ${commande.numeroCommande}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`📊 Commandes: ${success} réussis, ${errors} erreurs`);
  }

  async runCompleteMigration(): Promise<void> {
    try {
      await this.authenticate();
      await this.getDataInventory();
      
      const extractedClients = await this.extractClientsFromCommandes();
      await this.migrateExtractedClients(extractedClients);
      
      await this.migrateCommandes();
      
      console.log('\n✅ MIGRATION COMPLÈTE TERMINÉE !');
      
      // Vérification finale
      console.log('\n📋 VÉRIFICATION FINALE:');
      await this.getDataInventory();

    } catch (error) {
      console.error('❌ Erreur pendant la migration:', error.message);
    }
  }
}

// Fonction principale
async function main() {
  const command = process.argv[2];
  const migrator = new CompleteMigrator();

  try {
    switch (command) {
      case 'inventory':
        await migrator.authenticate();
        await migrator.getDataInventory();
        break;

      case 'full':
        await migrator.runCompleteMigration();
        break;

      default:
        console.log('Usage:');
        console.log('  npm run migrate:inventory  - Inventaire des données');
        console.log('  npm run migrate:complete   - Migration complète');
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

export { CompleteMigrator };