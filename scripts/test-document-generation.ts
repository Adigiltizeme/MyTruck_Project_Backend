import axios from 'axios';

const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class DocumentGenerationTester {
  private token: string = '';

  async authenticate(): Promise<void> {
    console.log('🔐 Authentification production...');

    const authResponse = await axios.post(`${PRODUCTION_URL}/auth/login`, {
      email: 'admin@test.com',
      password: 'admin123'
    });

    this.token = authResponse.data.access_token;
    console.log('✅ Authentification réussie');
  }

  async testCloudinaryConfig(): Promise<void> {
    console.log('\n🔍 Test configuration Cloudinary...');
    
    const headers = { Authorization: `Bearer ${this.token}` };

    try {
      const response = await axios.get(`${PRODUCTION_URL}/documents/debug-cloudinary`, { headers });
      console.log('📄 Configuration Cloudinary:', JSON.stringify(response.data, null, 2));
    } catch (error) {
      console.log('❌ Erreur test Cloudinary:', error.response?.data || error.message);
    }
  }

  async testDocumentGeneration(): Promise<void> {
    console.log('\n📦 Test génération document...');
    
    const headers = { Authorization: `Bearer ${this.token}` };

    // D'abord récupérer une commande
    try {
      const commandesResponse = await axios.get(`${PRODUCTION_URL}/commandes?take=1`, { headers });
      
      if (commandesResponse.data.data.length === 0) {
        console.log('❌ Aucune commande trouvée en production');
        return;
      }

      const commande = commandesResponse.data.data[0];
      console.log(`📦 Test avec commande ${commande.numeroCommande} (ID: ${commande.id})`);

      // Essayer de générer le document
      try {
        const docResponse = await axios.post(
          `${PRODUCTION_URL}/documents/commandes/${commande.id}/bon-commande`, 
          {}, 
          { headers }
        );
        
        console.log('✅ Document généré avec succès !');
        console.log(`📄 Document ID: ${docResponse.data.id}`);
        console.log(`📄 URL: ${docResponse.data.url}`);
      } catch (docError) {
        console.log('❌ Erreur génération document:');
        console.log('Status:', docError.response?.status);
        console.log('Headers:', docError.response?.headers);
        console.log('Data:', JSON.stringify(docError.response?.data, null, 2));
      }

    } catch (error) {
      console.log('❌ Erreur récupération commandes:', error.response?.data || error.message);
    }
  }

  async run(): Promise<void> {
    try {
      await this.authenticate();
      await this.testCloudinaryConfig();
      await this.testDocumentGeneration();
    } catch (error) {
      console.error('❌ Erreur globale:', error.message);
    }
  }
}

async function main() {
  const tester = new DocumentGenerationTester();
  await tester.run();
}

if (require.main === module) {
  main();
}

export { DocumentGenerationTester };