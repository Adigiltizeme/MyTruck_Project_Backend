import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class CompletCommandeMigrator {
  private localToken: string = '';
  private productionToken: string = '';

  async authenticate(): Promise<void> {
    console.log('🔐 Authentification...');

    const [localAuth, prodAuth] = await Promise.all([
      axios.post(`${LOCAL_URL}/auth/login`, {
        email: 'admin@test.com',
        password: 'admin123'
      }),
      axios.post(`${PRODUCTION_URL}/auth/login`, {
        email: 'admin@test.com',
        password: 'admin123'
      })
    ]);

    this.localToken = localAuth.data.access_token;
    this.productionToken = prodAuth.data.access_token;
    console.log('✅ Connexions réussies');
  }

  async migrateClients(): Promise<Map<string, string>> {
    console.log('\n🏢 MIGRATION DES CLIENTS...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    // Récupérer tous les détails des commandes pour extraire les clients uniques
    const commandesResponse = await axios.get(`${LOCAL_URL}/commandes?take=1000`, { headers: localHeaders });
    const commandes = commandesResponse.data.data;

    const clientsUniques = new Map();
    
    for (const cmd of commandes) {
      try {
        const detailResponse = await axios.get(`${LOCAL_URL}/commandes/${cmd.id}`, { headers: localHeaders });
        const detail = detailResponse.data;
        
        if (detail.client && !clientsUniques.has(detail.client.id)) {
          clientsUniques.set(detail.client.id, {
            oldId: detail.client.id, // On garde pour le mapping
            nom: detail.client.nom,
            prenom: detail.client.prenom || '',
            telephone: detail.client.telephone || '',
            telephoneSecondaire: detail.client.telephoneSecondaire || '',
            adresseLigne1: detail.client.adresseLigne1 || 'Adresse à préciser',
            batiment: detail.client.batiment || '',
            etage: detail.client.etage || '',
            interphone: detail.client.interphone || '',
            ascenseur: detail.client.ascenseur || false,
            typeAdresse: detail.client.typeAdresse || 'Domicile'
          });
        }
      } catch (error) {
        console.log(`   ⚠️ Erreur détail commande ${cmd.id}: ${error.message}`);
      }
    }

    console.log(`   📋 ${clientsUniques.size} clients uniques trouvés`);
    
    const clientIdMapping = new Map(); // oldId -> newId
    let success = 0;

    for (const [oldId, clientData] of clientsUniques) {
      try {
        // Enlever les champs non acceptés par l'API
        const { oldId: _, ...clientPayload } = clientData;
        
        const response = await axios.post(`${PRODUCTION_URL}/clients`, clientPayload, { headers: prodHeaders });
        clientIdMapping.set(oldId, response.data.id);
        console.log(`   ✅ ${clientData.nom} ${clientData.prenom}`);
        success++;
      } catch (error) {
        console.log(`   ❌ ${clientData.nom}: ${error.response?.data?.message || error.message}`);
      }
    }

    console.log(`📊 Clients migrés: ${success}/${clientsUniques.size}`);
    return clientIdMapping;
  }

  async getMagasinMapping(): Promise<Map<string, string>> {
    console.log('\n🏪 MAPPING DES MAGASINS...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    const [localMagasins, prodMagasins] = await Promise.all([
      axios.get(`${LOCAL_URL}/magasins?take=100`, { headers: localHeaders }),
      axios.get(`${PRODUCTION_URL}/magasins?take=100`, { headers: prodHeaders })
    ]);

    const magasinMapping = new Map();
    
    for (const localMag of localMagasins.data.data) {
      const prodMag = prodMagasins.data.data.find(m => m.nom === localMag.nom);
      if (prodMag) {
        magasinMapping.set(localMag.id, prodMag.id);
        console.log(`   ✅ ${localMag.nom}: ${localMag.id} -> ${prodMag.id}`);
      } else {
        console.log(`   ❌ Magasin non trouvé en production: ${localMag.nom}`);
      }
    }

    console.log(`📊 Mapping magasins: ${magasinMapping.size} mappés`);
    return magasinMapping;
  }

  async migrateCommandes(clientMapping: Map<string, string>, magasinMapping: Map<string, string>): Promise<void> {
    console.log('\n📦 MIGRATION DES COMMANDES...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    const commandesResponse = await axios.get(`${LOCAL_URL}/commandes?take=1000`, { headers: localHeaders });
    const commandes = commandesResponse.data.data;

    let success = 0;
    let errors = 0;

    for (let i = 0; i < commandes.length; i++) {
      const cmd = commandes[i];
      console.log(`\n📦 [${i + 1}/${commandes.length}] ${cmd.numeroCommande}...`);
      
      try {
        // Récupérer les détails complets
        const detailResponse = await axios.get(`${LOCAL_URL}/commandes/${cmd.id}`, { headers: localHeaders });
        const detail = detailResponse.data;
        
        // Mapping des IDs
        const newClientId = clientMapping.get(detail.client?.id);
        const newMagasinId = magasinMapping.get(detail.magasin?.id);
        
        if (!newClientId || !newMagasinId) {
          console.log(`   ❌ Mapping manquant: client=${!!newClientId}, magasin=${!!newMagasinId}`);
          errors++;
          continue;
        }

        const commandeData = {
          dateLivraison: cmd.dateLivraison,
          creneauLivraison: cmd.creneauLivraison || '14h-16h',
          categorieVehicule: cmd.categorieVehicule,
          optionEquipier: cmd.optionEquipier || 0,
          tarifHT: parseFloat(cmd.tarifHT) || 0,
          reserveTransport: cmd.reserveTransport || false,
          magasinId: newMagasinId,
          prenomVendeur: cmd.prenomVendeur,
          remarques: cmd.remarques,
          // Informations client directes (requis par l'API)
          clientNom: detail.client.nom,
          clientPrenom: detail.client.prenom || '',
          clientTelephone: detail.client.telephone || '0100000000',
          clientTelephoneSecondaire: detail.client.telephoneSecondaire || '',
          clientAdresseLigne1: detail.client.adresseLigne1 || 'Adresse à préciser',
          clientBatiment: detail.client.batiment || '',
          clientEtage: detail.client.etage || '',
          clientInterphone: detail.client.interphone || '',
          clientAscenseur: detail.client.ascenseur || false,
          clientTypeAdresse: detail.client.typeAdresse || 'Domicile',
          // Articles (requis)
          nombreArticles: 1, // Par défaut
          detailsArticles: 'Articles de commande migrée',
          categoriesArticles: ['Divers'],
          dimensionsArticles: [],
          photosArticles: [],
          newPhotosArticles: [],
          canBeTilted: false
        };

        const response = await axios.post(`${PRODUCTION_URL}/commandes`, commandeData, { headers: prodHeaders });
        console.log(`   ✅ Créée (ID: ${response.data.id})`);
        success++;

        // Pause pour éviter de surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`   ❌ ${cmd.numeroCommande}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`\n📊 RÉSULTAT MIGRATION COMMANDES:`);
    console.log(`   ✅ Réussies: ${success}/${commandes.length}`);
    console.log(`   ❌ Erreurs: ${errors}/${commandes.length}`);
  }

  async runCompleteMigration(): Promise<void> {
    try {
      await this.authenticate();
      
      const clientMapping = await this.migrateClients();
      const magasinMapping = await this.getMagasinMapping();
      
      await this.migrateCommandes(clientMapping, magasinMapping);
      
      console.log('\n✅ MIGRATION COMPLÈTE TERMINÉE !');
      
      // Vérification finale
      console.log('\n📋 VÉRIFICATION FINALE...');
      const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };
      const verification = await axios.get(`${PRODUCTION_URL}/commandes`, { headers: prodHeaders });
      console.log(`📦 Commandes en production: ${verification.data.meta.total}`);

    } catch (error) {
      console.error('❌ Erreur globale:', error.message);
    }
  }
}

async function main() {
  const migrator = new CompletCommandeMigrator();
  await migrator.runCompleteMigration();
}

if (require.main === module) {
  main();
}

export { CompletCommandeMigrator };