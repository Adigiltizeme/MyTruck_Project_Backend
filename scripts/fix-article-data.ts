import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class ArticleDataFixer {
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

  async fixArticleData(commandeMapping: Map<string, any>): Promise<void> {
    console.log('\n📦 CORRECTION DES DONNÉES ARTICLES...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    let success = 0;
    let errors = 0;
    let articlesProcessed = 0;

    for (const [numeroCommande, mapping] of commandeMapping) {
      try {
        const { localId, prodId } = mapping;
        
        // Récupérer les détails complets locaux
        const localDetail = await axios.get(`${LOCAL_URL}/commandes/${localId}`, { headers: localHeaders });
        const localData = localDetail.data;
        
        if (localData.articles && localData.articles.length > 0) {
          for (const article of localData.articles) {
            articlesProcessed++;
            
            // Préparer les données d'article corrigées
            const articleUpdate: any = {};
            
            // Nombre d'articles réel
            if (article.nombre && article.nombre !== 1) {
              articleUpdate.nombreArticles = article.nombre;
            }
            
            // Détails réels de l'article
            if (article.details && article.details.trim() !== '') {
              articleUpdate.detailsArticles = article.details.trim();
            }
            
            // Catégories réelles (si disponibles)
            if (article.categories && Array.isArray(article.categories) && article.categories.length > 0) {
              articleUpdate.categoriesArticles = article.categories;
            }
            
            // Dimensions réelles
            if (article.dimensions && Array.isArray(article.dimensions) && article.dimensions.length > 0) {
              const dimensionsFormatted = article.dimensions.map(dim => ({
                id: dim.id || `dim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                nom: dim.nom || 'Article',
                longueur: parseFloat(dim.longueur) || 0,
                largeur: parseFloat(dim.largeur) || 0,
                hauteur: parseFloat(dim.hauteur) || 0,
                poids: parseFloat(dim.poids) || 0,
                quantite: parseInt(dim.quantite) || 1
              }));
              articleUpdate.dimensionsArticles = dimensionsFormatted;
            }
            
            // Photos (si disponibles)
            if (article.photos && Array.isArray(article.photos) && article.photos.length > 0) {
              articleUpdate.photosArticles = article.photos;
            }
            
            // Option inclinaison
            if (article.canBeTilted !== undefined) {
              articleUpdate.canBeTilted = article.canBeTilted;
            }

            // Mettre à jour la commande si on a des changements
            if (Object.keys(articleUpdate).length > 0) {
              await axios.patch(`${PRODUCTION_URL}/commandes/${prodId}`, articleUpdate, { headers: prodHeaders });
              console.log(`   ✅ ${numeroCommande}: ${Object.keys(articleUpdate).length} champs articles mis à jour`);
              success++;
            }
          }
        }
      } catch (error) {
        console.log(`   ❌ ${numeroCommande}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
      
      // Pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`📊 Articles traités: ${articlesProcessed}`);
    console.log(`📊 Commandes mises à jour: ${success} réussies, ${errors} erreurs`);
  }

  async runArticleFixing(): Promise<void> {
    try {
      await this.authenticate();
      
      // 1. Construire le mapping des commandes
      const commandeMapping = await this.buildCommandeMapping();
      
      // 2. Corriger les données d'articles
      await this.fixArticleData(commandeMapping);
      
      console.log('\n✅ CORRECTION DES ARTICLES TERMINÉE !');
      console.log('\n📋 Les données articles suivantes ont été restaurées:');
      console.log('   ✅ Nombres réels d\'articles par commande');
      console.log('   ✅ Détails descriptifs des articles');
      console.log('   ✅ Catégories spécifiques');
      console.log('   ✅ Dimensions détaillées (longueur, largeur, hauteur, poids)');
      console.log('   ✅ Options d\'inclinaison');

    } catch (error) {
      console.error('❌ Erreur globale:', error.message);
    }
  }
}

async function main() {
  const fixer = new ArticleDataFixer();
  await fixer.runArticleFixing();
}

if (require.main === module) {
  main();
}

export { ArticleDataFixer };