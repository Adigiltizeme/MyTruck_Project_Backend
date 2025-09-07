import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class MissingDataAnalyzer {
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
    console.log('✅ Authentifications réussies');
  }

  async analyzeDetailedDifferences(): Promise<void> {
    console.log('\n🔍 ANALYSE DÉTAILLÉE DES DIFFÉRENCES...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    // 1. Analyser quelques commandes locales vs production
    console.log('\n📦 COMPARAISON DES COMMANDES:');
    
    const [localCommandes, prodCommandes] = await Promise.all([
      axios.get(`${LOCAL_URL}/commandes?take=5`, { headers: localHeaders }),
      axios.get(`${PRODUCTION_URL}/commandes?take=5`, { headers: prodHeaders })
    ]);

    console.log('\n🏠 LOCAL - Échantillon commande:');
    if (localCommandes.data.data.length > 0) {
      const cmd = localCommandes.data.data[0];
      console.log(`   📦 ${cmd.numeroCommande}:`);
      console.log(`     Statut commande: ${cmd.statutCommande}`);
      console.log(`     Statut livraison: ${cmd.statutLivraison}`);
      console.log(`     Tarif HT: ${cmd.tarifHT}`);
      console.log(`     Réserve transport: ${cmd.reserveTransport}`);
      console.log(`     Catégorie véhicule: ${cmd.categorieVehicule || 'N/A'}`);
      console.log(`     Option équipier: ${cmd.optionEquipier}`);
      
      // Détails complets
      try {
        const detailLocal = await axios.get(`${LOCAL_URL}/commandes/${cmd.id}`, { headers: localHeaders });
        const detail = detailLocal.data;
        console.log(`     Client: ${detail.client?.nom} ${detail.client?.prenom || ''}`);
        console.log(`     Magasin: ${detail.magasin?.nom}`);
        console.log(`     Chauffeurs assignés: ${detail.chauffeurs?.length || 0}`);
        if (detail.chauffeurs?.length > 0) {
          detail.chauffeurs.forEach((ch, i) => {
            console.log(`       • ${i + 1}: ${ch.chauffeur?.nom} ${ch.chauffeur?.prenom || ''}`);
          });
        }
        console.log(`     Documents: ${detail.documents?.length || 0}`);
        console.log(`     Articles: ${detail.articles?.length || 0}`);
        if (detail.articles?.length > 0) {
          detail.articles.forEach((art, i) => {
            console.log(`       • Article ${i + 1}: ${art.nombre} x "${art.details || 'N/A'}"`);
          });
        }
      } catch (error) {
        console.log(`     ❌ Erreur détail: ${error.message}`);
      }
    }

    console.log('\n🌐 PRODUCTION - Échantillon commande:');
    if (prodCommandes.data.data.length > 0) {
      const cmd = prodCommandes.data.data[0];
      console.log(`   📦 ${cmd.numeroCommande}:`);
      console.log(`     Statut commande: ${cmd.statutCommande}`);
      console.log(`     Statut livraison: ${cmd.statutLivraison}`);
      console.log(`     Tarif HT: ${cmd.tarifHT}`);
      console.log(`     Réserve transport: ${cmd.reserveTransport}`);
      console.log(`     Catégorie véhicule: ${cmd.categorieVehicule || 'N/A'}`);
      console.log(`     Option équipier: ${cmd.optionEquipier}`);

      try {
        const detailProd = await axios.get(`${PRODUCTION_URL}/commandes/${cmd.id}`, { headers: prodHeaders });
        const detail = detailProd.data;
        console.log(`     Client: ${detail.client?.nom} ${detail.client?.prenom || ''}`);
        console.log(`     Magasin: ${detail.magasin?.nom}`);
        console.log(`     Chauffeurs assignés: ${detail.chauffeurs?.length || 0}`);
        console.log(`     Documents: ${detail.documents?.length || 0}`);
        console.log(`     Articles: ${detail.articles?.length || 0}`);
      } catch (error) {
        console.log(`     ❌ Erreur détail: ${error.message}`);
      }
    }

    // 2. Analyser les statuts
    console.log('\n📊 ANALYSE DES STATUTS:');
    await this.analyzeStatuts();

    // 3. Analyser les relations manquantes
    console.log('\n🔗 ANALYSE DES RELATIONS:');
    await this.analyzeRelations();
  }

  async analyzeStatuts(): Promise<void> {
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    // Récupérer toutes les commandes pour analyser les statuts
    const [localCommandes, prodCommandes] = await Promise.all([
      axios.get(`${LOCAL_URL}/commandes?take=1000`, { headers: localHeaders }),
      axios.get(`${PRODUCTION_URL}/commandes?take=1000`, { headers: prodHeaders })
    ]);

    // Grouper par statuts
    const localStatutsCmd = new Map();
    const localStatutsLiv = new Map();
    const prodStatutsCmd = new Map();
    const prodStatutsLiv = new Map();

    localCommandes.data.data.forEach(cmd => {
      localStatutsCmd.set(cmd.statutCommande, (localStatutsCmd.get(cmd.statutCommande) || 0) + 1);
      localStatutsLiv.set(cmd.statutLivraison, (localStatutsLiv.get(cmd.statutLivraison) || 0) + 1);
    });

    prodCommandes.data.data.forEach(cmd => {
      prodStatutsCmd.set(cmd.statutCommande, (prodStatutsCmd.get(cmd.statutCommande) || 0) + 1);
      prodStatutsLiv.set(cmd.statutLivraison, (prodStatutsLiv.get(cmd.statutLivraison) || 0) + 1);
    });

    console.log('\n   📋 STATUTS COMMANDES:');
    console.log('     LOCAL:');
    Array.from(localStatutsCmd.entries()).forEach(([statut, count]) => {
      console.log(`       • ${statut}: ${count}`);
    });
    console.log('     PRODUCTION:');
    Array.from(prodStatutsCmd.entries()).forEach(([statut, count]) => {
      console.log(`       • ${statut}: ${count}`);
    });

    console.log('\n   🚚 STATUTS LIVRAISONS:');
    console.log('     LOCAL:');
    Array.from(localStatutsLiv.entries()).forEach(([statut, count]) => {
      console.log(`       • ${statut}: ${count}`);
    });
    console.log('     PRODUCTION:');
    Array.from(prodStatutsLiv.entries()).forEach(([statut, count]) => {
      console.log(`       • ${statut}: ${count}`);
    });
  }

  async analyzeRelations(): Promise<void> {
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    // Analyser les relations chauffeurs
    console.log('\n   🚚 RELATIONS CHAUFFEURS:');
    
    // Prendre quelques commandes locales avec chauffeurs
    const localCommandes = await axios.get(`${LOCAL_URL}/commandes?take=20`, { headers: localHeaders });
    
    let localAvecChauffeurs = 0;
    let localSansChauffeurs = 0;

    for (const cmd of localCommandes.data.data) {
      try {
        const detail = await axios.get(`${LOCAL_URL}/commandes/${cmd.id}`, { headers: localHeaders });
        if (detail.data.chauffeurs?.length > 0) {
          localAvecChauffeurs++;
        } else {
          localSansChauffeurs++;
        }
      } catch (error) {
        localSansChauffeurs++;
      }
    }

    console.log(`     LOCAL: ${localAvecChauffeurs} avec chauffeurs, ${localSansChauffeurs} sans`);

    // Même chose pour production
    const prodCommandes = await axios.get(`${PRODUCTION_URL}/commandes?take=20`, { headers: prodHeaders });
    
    let prodAvecChauffeurs = 0;
    let prodSansChauffeurs = 0;

    for (const cmd of prodCommandes.data.data) {
      try {
        const detail = await axios.get(`${PRODUCTION_URL}/commandes/${cmd.id}`, { headers: prodHeaders });
        if (detail.data.chauffeurs?.length > 0) {
          prodAvecChauffeurs++;
        } else {
          prodSansChauffeurs++;
        }
      } catch (error) {
        prodSansChauffeurs++;
      }
    }

    console.log(`     PRODUCTION: ${prodAvecChauffeurs} avec chauffeurs, ${prodSansChauffeurs} sans`);
  }

  async run(): Promise<void> {
    try {
      await this.authenticate();
      await this.analyzeDetailedDifferences();
      
      console.log('\n💡 RECOMMANDATIONS:');
      console.log('   1. Mettre à jour les statuts corrects des commandes');
      console.log('   2. Restaurer les affectations chauffeurs');
      console.log('   3. Migrer les documents attachés');
      console.log('   4. Transférer les articles détaillés');
      console.log('   5. Préserver les données historiques');

    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }
}

async function main() {
  const analyzer = new MissingDataAnalyzer();
  await analyzer.run();
}

if (require.main === module) {
  main();
}

export { MissingDataAnalyzer };