// scripts/test-api.js (version simple sans TypeScript pour éviter les problèmes de compilation)
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/v1';

class ApiTester {
  constructor() {
    this.token = null;
    this.results = [];
  }

  async login(email, password) {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email,
        password,
      });

      this.token = response.data.access_token;
      console.log('✅ Connexion réussie');
      return true;
    } catch (error) {
      console.error('❌ Échec de la connexion:', error.response?.data?.message || error.message);
      return false;
    }
  }

  getHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  async testEndpoint(method, endpoint, data) {
    const fullUrl = `${API_BASE}${endpoint}`;
    const config = {
      method: method.toLowerCase(),
      url: fullUrl,
      headers: this.getHeaders(),
      data,
    };

    try {
      const response = await axios(config);
      console.log(`✅ ${method} ${endpoint} - ${response.status}`);
      this.results.push({ endpoint, method, status: response.status, success: true });
      return { success: true, data: response.data, status: response.status };
    } catch (error) {
      const status = error.response?.status || 0;
      const errorMsg = error.response?.data?.message || error.message;
      console.log(`❌ ${method} ${endpoint} - ${status} - ${errorMsg}`);
      this.results.push({ endpoint, method, status, success: false, error: errorMsg });
      return { success: false, error: errorMsg, status };
    }
  }

  async runBasicTests() {
    console.log('🚀 Démarrage des tests API basiques...\n');

    // Test de santé
    await this.testEndpoint('GET', '/health');
    await this.testEndpoint('GET', '/health/version');

    // Connexion avec les comptes de test
    const loginSuccess = await this.login('admin@mytruck.com', 'MyTruck2024!');
    if (!loginSuccess) {
      console.log('❌ Impossible de continuer sans authentification');
      return;
    }

    // Tests des endpoints principaux
    await this.testEndpoint('GET', '/auth/profile');
    await this.testEndpoint('GET', '/users');
    await this.testEndpoint('GET', '/magasins');
    await this.testEndpoint('GET', '/chauffeurs');
    await this.testEndpoint('GET', '/clients');
    await this.testEndpoint('GET', '/commandes');
    await this.testEndpoint('GET', '/commandes/stats');

    // Test de création d'un magasin
    const magasinData = {
      nom: 'Magasin Test API',
      adresse: '123 Rue de Test, 75001 Paris',
      telephone: '+33123456789',
      email: 'test@magasin.com',
      categories: ['Test']
    };
    const magasinResult = await this.testEndpoint('POST', '/magasins', magasinData);

    // Test de création d'un chauffeur
    const chauffeurData = {
      nom: 'Test',
      prenom: 'Chauffeur',
      telephone: '+33987654321',
      email: 'chauffeur.test@mytruck.com',
      notes: 4
    };
    const chauffeurResult = await this.testEndpoint('POST', '/chauffeurs', chauffeurData);

    // Test de création d'une commande si on a un magasin
    if (magasinResult.success && magasinResult.data?.id) {
      const commandeData = {
        dateLivraison: '2024-12-25',
        creneauLivraison: '10h-12h',
        categorieVehicule: '6M3 (Camionnette 300kg, 240x169x138cm)',
        optionEquipier: 1,
        tarifHT: 85.50,
        magasinId: magasinResult.data.id,
        client: {
          nom: 'Client Test',
          prenom: 'API',
          telephone: '+33111222333',
          adresseLigne1: '456 Avenue du Test, 75002 Paris',
          ville: 'Paris',
          typeAdresse: 'Domicile'
        },
        articles: {
          nombre: 3,
          details: 'Articles de test API',
          categories: ['Test']
        },
        prenomVendeur: 'Vendeur Test'
      };

      if (chauffeurResult.success && chauffeurResult.data?.id) {
        commandeData.chauffeurIds = [chauffeurResult.data.id];
      }

      await this.testEndpoint('POST', '/commandes', commandeData);
    }

    // Résumé des résultats
    this.printSummary();
  }

  printSummary() {
    console.log('\n📊 Résumé des tests:');
    console.log('==================');
    
    const totalTests = this.results.length;
    const successfulTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - successfulTests;

    console.log(`✅ Tests réussis: ${successfulTests}/${totalTests}`);
    console.log(`❌ Tests échoués: ${failedTests}/${totalTests}`);
    
    if (failedTests > 0) {
      console.log('\n❌ Échecs détaillés:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   ${r.method} ${r.endpoint} - ${r.status} - ${r.error}`);
        });
    }
    
    console.log(`\n🎯 Taux de réussite: ${Math.round((successfulTests / totalTests) * 100)}%`);
  }
}

// Fonction principale
async function main() {
  const tester = new ApiTester();
  
  try {
    await tester.runBasicTests();
    console.log('\n🎉 Tests terminés!');
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    process.exit(1);
  }
}

main();