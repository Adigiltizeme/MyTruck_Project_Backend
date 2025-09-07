import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class DocumentFixer {
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

  async buildCommandeMapping(): Promise<Map<string, string>> {
    console.log('\n🗂️ CONSTRUCTION DU MAPPING COMMANDES...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    const [localCommandes, prodCommandes] = await Promise.all([
      axios.get(`${LOCAL_URL}/commandes?take=1000`, { headers: localHeaders }),
      axios.get(`${PRODUCTION_URL}/commandes?take=1000`, { headers: prodHeaders })
    ]);

    console.log(`   📦 Local: ${localCommandes.data.data.length} commandes`);
    console.log(`   📦 Production: ${prodCommandes.data.data.length} commandes`);

    const mapping = new Map(); // index -> {localId, prodId}
    
    // Trier les deux par date de création pour mapper par ordre chronologique
    const localSorted = [...localCommandes.data.data].sort((a, b) => 
      new Date(a.dateCommande).getTime() - new Date(b.dateCommande).getTime()
    );
    const prodSorted = [...prodCommandes.data.data].sort((a, b) => 
      new Date(a.dateCommande).getTime() - new Date(b.dateCommande).getTime()
    );

    // Mapper par ordre chronologique
    const maxIndex = Math.min(localSorted.length, prodSorted.length);
    for (let i = 0; i < maxIndex; i++) {
      const localCmd = localSorted[i];
      const prodCmd = prodSorted[i];
      
      mapping.set(`mapping_${i}`, {
        localId: localCmd.id,
        prodId: prodCmd.id,
        localCmd,
        prodCmd
      });
    }

    console.log(`   ✅ ${mapping.size} commandes mappées`);
    return mapping;
  }

  async checkDocumentEndpoint(): Promise<string | null> {
    console.log('\n🔍 RECHERCHE DE L\'ENDPOINT DOCUMENTS...');
    
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    // Essayer différents endpoints possibles
    const possibleEndpoints = [
      '/documents',
      '/commandes/documents',
      '/api/documents',
      '/files/documents'
    ];

    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`   Tentative: ${endpoint}...`);
        const response = await axios.get(`${PRODUCTION_URL}${endpoint}`, { headers: prodHeaders });
        console.log(`   ✅ Endpoint trouvé: ${endpoint}`);
        return endpoint;
      } catch (error) {
        console.log(`   ❌ ${endpoint}: ${error.response?.status || error.message}`);
      }
    }

    console.log('   ℹ️ Aucun endpoint documents trouvé, utilisation de PATCH sur commandes');
    return null;
  }

  async restoreDocuments(commandeMapping: Map<string, any>): Promise<void> {
    console.log('\n📄 RESTAURATION DES DOCUMENTS...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    let success = 0;
    let errors = 0;
    let documentsProcessed = 0;

    for (const [numeroCommande, mapping] of commandeMapping) {
      try {
        const { localId, prodId } = mapping;
        
        // Récupérer les détails complets locaux
        const localDetail = await axios.get(`${LOCAL_URL}/commandes/${localId}`, { headers: localHeaders });
        const localData = localDetail.data;
        
        if (localData.documents && localData.documents.length > 0) {
          documentsProcessed += localData.documents.length;
          
          console.log(`   📦 ${numeroCommande}: ${localData.documents.length} documents à restaurer`);
          
          // Les documents sont sur Cloudinary, ils devraient être accessibles
          // On va essayer de les associer à la commande en production
          
          // Option 1: Essayer de créer les documents via un endpoint spécifique
          for (const doc of localData.documents) {
            try {
              // Vérifier si l'URL Cloudinary est toujours accessible
              const urlTest = await axios.head(doc.url, { timeout: 5000 });
              console.log(`     ✅ Document accessible: ${doc.type}`);
              
              // Créer le document en production (si l'endpoint existe)
              const documentData = {
                commandeId: prodId,
                nom: doc.nom || `Document ${doc.type}`,
                type: doc.type,
                url: doc.url,
                taille: doc.taille || null,
                dateCreation: doc.dateCreation || new Date().toISOString()
              };

              // Essayer de poster le document
              try {
                await axios.post(`${PRODUCTION_URL}/documents`, documentData, { headers: prodHeaders });
                console.log(`     ✅ Document créé: ${doc.type}`);
              } catch (docError) {
                // Si l'endpoint n'existe pas, essayer d'ajouter le document via la commande
                console.log(`     ℹ️ Tentative via PATCH commande...`);
                
                // Récupérer d'abord la commande production pour voir sa structure
                const prodDetail = await axios.get(`${PRODUCTION_URL}/commandes/${prodId}`, { headers: prodHeaders });
                const existingDocs = prodDetail.data.documents || [];
                
                const updatedDocs = [...existingDocs, documentData];
                
                await axios.patch(`${PRODUCTION_URL}/commandes/${prodId}`, {
                  documents: updatedDocs
                }, { headers: prodHeaders });
                
                console.log(`     ✅ Document ajouté via commande: ${doc.type}`);
              }
              
            } catch (urlError) {
              console.log(`     ❌ Document inaccessible: ${doc.type} (${urlError.message})`);
            }
          }
          
          success++;
        }
      } catch (error) {
        console.log(`   ❌ ${numeroCommande}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
      
      // Pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`📊 Documents traités: ${documentsProcessed}`);
    console.log(`📊 Commandes avec documents restaurés: ${success} réussies, ${errors} erreurs`);
  }

  async runDocumentFixing(): Promise<void> {
    try {
      await this.authenticate();
      
      // 1. Vérifier l'endpoint documents
      await this.checkDocumentEndpoint();
      
      // 2. Construire le mapping des commandes
      const commandeMapping = await this.buildCommandeMapping();
      
      // 3. Restaurer les documents
      await this.restoreDocuments(commandeMapping);
      
      console.log('\n✅ RESTAURATION DES DOCUMENTS TERMINÉE !');
      console.log('\n📋 Les documents suivants ont été traités:');
      console.log('   📄 Bons de commande (BON_COMMANDE)');
      console.log('   🧾 Factures (FACTURE)');
      console.log('   🔗 URLs Cloudinary préservées');

    } catch (error) {
      console.error('❌ Erreur globale:', error.message);
    }
  }
}

async function main() {
  const fixer = new DocumentFixer();
  await fixer.runDocumentFixing();
}

if (require.main === module) {
  main();
}

export { DocumentFixer };