import axios from 'axios';

const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class ViewUrlTester {
  private token: string = '';

  async authenticate(): Promise<void> {
    console.log('🔐 Authentification production...');

    const authResponse = await axios.post(`${PRODUCTION_URL}/auth/login`, {
      email: 'admin@test.com',
      password: 'admin123'
    });

    this.token = authResponse.data.access_token;
    console.log('✅ Authentification réussie');
    console.log('🎟️ Token:', this.token.substring(0, 50) + '...');
  }

  async testViewUrl(documentId: string): Promise<void> {
    console.log(`\n🔍 Test view-url pour document ${documentId}...`);
    
    const headers = { 
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await axios.get(`${PRODUCTION_URL}/documents/${documentId}/view-url`, { headers });
      console.log('✅ View-url généré avec succès !');
      console.log(`📄 URL: ${response.data.viewUrl}`);
      console.log(`⏱️ Expire dans: ${response.data.expiresIn}`);
    } catch (error) {
      console.log('❌ Erreur view-url:');
      console.log('Status:', error.response?.status);
      console.log('Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('Headers envoyés:', headers);
    }
  }

  async testWithNewDocument(): Promise<void> {
    console.log('\n📦 Génération d\'un nouveau document pour test...');
    
    const headers = { Authorization: `Bearer ${this.token}` };

    try {
      // Récupérer une commande
      const commandesResponse = await axios.get(`${PRODUCTION_URL}/commandes?take=1`, { headers });
      const commande = commandesResponse.data.data[0];
      
      console.log(`📦 Commande: ${commande.numeroCommande}`);

      // Générer le document
      const docResponse = await axios.post(
        `${PRODUCTION_URL}/documents/commandes/${commande.id}/bon-commande`, 
        {}, 
        { headers }
      );
      
      console.log(`✅ Document créé: ${docResponse.data.id}`);
      
      // Tester immédiatement le view-url
      await this.testViewUrl(docResponse.data.id);
      
    } catch (error) {
      console.log('❌ Erreur:', error.response?.data || error.message);
    }
  }

  async run(): Promise<void> {
    try {
      await this.authenticate();
      await this.testWithNewDocument();
    } catch (error) {
      console.error('❌ Erreur globale:', error.message);
    }
  }
}

async function main() {
  const tester = new ViewUrlTester();
  await tester.run();
}

if (require.main === module) {
  main();
}

export { ViewUrlTester };