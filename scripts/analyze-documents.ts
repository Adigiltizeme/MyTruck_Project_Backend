import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class DocumentAnalyzer {
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

  async analyzeDocuments(): Promise<void> {
    console.log('\n📄 ANALYSE DES DOCUMENTS...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    // Récupérer quelques commandes pour analyser les documents
    const [localCommandes, prodCommandes] = await Promise.all([
      axios.get(`${LOCAL_URL}/commandes?take=20`, { headers: localHeaders }),
      axios.get(`${PRODUCTION_URL}/commandes?take=20`, { headers: prodHeaders })
    ]);

    console.log('\n🏠 LOCAL - Analyse documents:');
    let totalDocumentsLocal = 0;
    let commandesAvecDocuments = 0;

    for (let i = 0; i < localCommandes.data.data.length; i++) {
      const cmd = localCommandes.data.data[i];
      try {
        const detailResponse = await axios.get(`${LOCAL_URL}/commandes/${cmd.id}`, { headers: localHeaders });
        const detail = detailResponse.data;
        
        if (detail.documents && detail.documents.length > 0) {
          commandesAvecDocuments++;
          totalDocumentsLocal += detail.documents.length;
          
          if (commandesAvecDocuments <= 5) { // Afficher seulement les 5 premiers
            console.log(`   📦 Commande ${cmd.numeroCommande}:`);
            console.log(`     Documents: ${detail.documents.length}`);
            detail.documents.forEach((doc, idx) => {
              console.log(`       • ${idx + 1}: ${doc.nom} (${doc.type || 'N/A'})`);
              console.log(`         URL: ${doc.url || 'N/A'}`);
              console.log(`         Taille: ${doc.taille ? Math.round(doc.taille/1024) + 'KB' : 'N/A'}`);
            });
          }
        }
      } catch (error) {
        // Ignorer les erreurs pour continuer l'analyse
      }
    }

    console.log(`\n📊 STATISTIQUES LOCAL:`);
    console.log(`   📄 Total documents: ${totalDocumentsLocal}`);
    console.log(`   📦 Commandes avec documents: ${commandesAvecDocuments}/${localCommandes.data.data.length}`);

    console.log('\n🌐 PRODUCTION - Analyse documents:');
    let totalDocumentsProduction = 0;
    let commandesAvecDocumentsProd = 0;

    for (let i = 0; i < prodCommandes.data.data.length; i++) {
      const cmd = prodCommandes.data.data[i];
      try {
        const detailResponse = await axios.get(`${PRODUCTION_URL}/commandes/${cmd.id}`, { headers: prodHeaders });
        const detail = detailResponse.data;
        
        if (detail.documents && detail.documents.length > 0) {
          commandesAvecDocumentsProd++;
          totalDocumentsProduction += detail.documents.length;
          
          if (commandesAvecDocumentsProd <= 5) {
            console.log(`   📦 Commande ${cmd.numeroCommande}:`);
            console.log(`     Documents: ${detail.documents.length}`);
            detail.documents.forEach((doc, idx) => {
              console.log(`       • ${idx + 1}: ${doc.nom} (${doc.type || 'N/A'})`);
              console.log(`         URL: ${doc.url || 'N/A'}`);
            });
          }
        }
      } catch (error) {
        // Ignorer les erreurs pour continuer l'analyse
      }
    }

    console.log(`\n📊 STATISTIQUES PRODUCTION:`);
    console.log(`   📄 Total documents: ${totalDocumentsProduction}`);
    console.log(`   📦 Commandes avec documents: ${commandesAvecDocumentsProd}/${prodCommandes.data.data.length}`);
  }

  async checkStorageLocations(): Promise<void> {
    console.log('\n💾 VÉRIFICATION DES EMPLACEMENTS DE STOCKAGE...');
    
    // Vérifier si on a des endpoints de documents
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    try {
      console.log('   📁 Test endpoint /documents local...');
      const localDocs = await axios.get(`${LOCAL_URL}/documents`, { headers: localHeaders });
      console.log(`     ✅ Local: ${localDocs.data.length || 0} documents totaux`);
    } catch (error) {
      console.log(`     ❌ Endpoint local /documents: ${error.message}`);
    }

    try {
      console.log('   📁 Test endpoint /documents production...');
      const prodDocs = await axios.get(`${PRODUCTION_URL}/documents`, { headers: prodHeaders });
      console.log(`     ✅ Production: ${prodDocs.data.length || 0} documents totaux`);
    } catch (error) {
      console.log(`     ❌ Endpoint production /documents: ${error.message}`);
    }

    // Vérifier d'autres endpoints possibles
    try {
      console.log('   📁 Test endpoint /files local...');
      const localFiles = await axios.get(`${LOCAL_URL}/files`, { headers: localHeaders });
      console.log(`     ✅ Local /files: disponible`);
    } catch (error) {
      console.log(`     ❌ Endpoint local /files: ${error.message}`);
    }

    try {
      console.log('   📁 Test endpoint /uploads local...');
      const localUploads = await axios.get(`${LOCAL_URL}/uploads`, { headers: localHeaders });
      console.log(`     ✅ Local /uploads: disponible`);
    } catch (error) {
      console.log(`     ❌ Endpoint local /uploads: ${error.message}`);
    }
  }

  async run(): Promise<void> {
    try {
      await this.authenticate();
      await this.analyzeDocuments();
      await this.checkStorageLocations();
      
      console.log('\n💡 RECOMMANDATIONS DOCUMENTS:');
      console.log('   1. Identifier la méthode de stockage des documents (Cloudinary, S3, local)');
      console.log('   2. Migrer les documents vers le même service en production');
      console.log('   3. Mettre à jour les URLs des documents dans les commandes');
      console.log('   4. Vérifier l\'intégrité des fichiers après migration');

    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }
}

async function main() {
  const analyzer = new DocumentAnalyzer();
  await analyzer.run();
}

if (require.main === module) {
  main();
}

export { DocumentAnalyzer };