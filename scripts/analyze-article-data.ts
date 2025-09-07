import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class ArticleDataAnalyzer {
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

  async analyzeArticleDetails(): Promise<void> {
    console.log('\n📦 ANALYSE DÉTAILLÉE DES ARTICLES...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    // Récupérer quelques commandes pour analyser les articles
    const [localCommandes, prodCommandes] = await Promise.all([
      axios.get(`${LOCAL_URL}/commandes?take=10`, { headers: localHeaders }),
      axios.get(`${PRODUCTION_URL}/commandes?take=10`, { headers: prodHeaders })
    ]);

    console.log('\n🏠 LOCAL - Échantillon articles:');
    for (let i = 0; i < Math.min(5, localCommandes.data.data.length); i++) {
      const cmd = localCommandes.data.data[i];
      try {
        const detailResponse = await axios.get(`${LOCAL_URL}/commandes/${cmd.id}`, { headers: localHeaders });
        const detail = detailResponse.data;
        
        console.log(`\n   📦 Commande ${cmd.numeroCommande}:`);
        if (detail.articles && detail.articles.length > 0) {
          detail.articles.forEach((article, idx) => {
            console.log(`     Article ${idx + 1}:`);
            console.log(`       • Nombre: ${article.nombre}`);
            console.log(`       • Détails: ${article.details || 'N/A'}`);
            console.log(`       • Catégories: ${article.categories?.join(', ') || 'N/A'}`);
            console.log(`       • Dimensions: ${article.dimensions?.length || 0} entrées`);
            if (article.dimensions && article.dimensions.length > 0) {
              article.dimensions.forEach((dim, dimIdx) => {
                console.log(`         - ${dim.nom}: ${dim.longueur}x${dim.largeur}x${dim.hauteur}cm, ${dim.poids}kg, qty:${dim.quantite}`);
              });
            }
            console.log(`       • Photos: ${article.photos?.length || 0}`);
            console.log(`       • Peut être incliné: ${article.canBeTilted || false}`);
          });
        } else {
          console.log(`     ❌ Aucun article trouvé`);
        }
      } catch (error) {
        console.log(`     ❌ Erreur détail: ${error.message}`);
      }
    }

    console.log('\n🌐 PRODUCTION - Échantillon articles:');
    for (let i = 0; i < Math.min(5, prodCommandes.data.data.length); i++) {
      const cmd = prodCommandes.data.data[i];
      try {
        const detailResponse = await axios.get(`${PRODUCTION_URL}/commandes/${cmd.id}`, { headers: prodHeaders });
        const detail = detailResponse.data;
        
        console.log(`\n   📦 Commande ${cmd.numeroCommande}:`);
        if (detail.articles && detail.articles.length > 0) {
          detail.articles.forEach((article, idx) => {
            console.log(`     Article ${idx + 1}:`);
            console.log(`       • Nombre: ${article.nombre}`);
            console.log(`       • Détails: ${article.details || 'N/A'}`);
            console.log(`       • Catégories: ${article.categories?.join(', ') || 'N/A'}`);
            console.log(`       • Dimensions: ${article.dimensions?.length || 0} entrées`);
            console.log(`       • Photos: ${article.photos?.length || 0}`);
            console.log(`       • Peut être incliné: ${article.canBeTilted || false}`);
          });
        } else {
          console.log(`     ❌ Aucun article trouvé`);
        }
      } catch (error) {
        console.log(`     ❌ Erreur détail: ${error.message}`);
      }
    }
  }

  async analyzeAllArticles(): Promise<void> {
    console.log('\n📊 ANALYSE COMPLÈTE DES ARTICLES...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };

    const commandesResponse = await axios.get(`${LOCAL_URL}/commandes?take=100`, { headers: localHeaders });
    const commandes = commandesResponse.data.data;

    let totalArticles = 0;
    let articlesAvecDimensions = 0;
    let articlesAvecPhotos = 0;
    let articlesAvecCategories = 0;
    let articlesAvecDetails = 0;

    console.log(`   📦 Analyse de ${commandes.length} commandes...`);

    for (const cmd of commandes) {
      try {
        const detailResponse = await axios.get(`${LOCAL_URL}/commandes/${cmd.id}`, { headers: localHeaders });
        const detail = detailResponse.data;
        
        if (detail.articles && detail.articles.length > 0) {
          detail.articles.forEach(article => {
            totalArticles++;
            
            if (article.dimensions && article.dimensions.length > 0) {
              articlesAvecDimensions++;
            }
            if (article.photos && article.photos.length > 0) {
              articlesAvecPhotos++;
            }
            if (article.categories && article.categories.length > 0) {
              articlesAvecCategories++;
            }
            if (article.details && article.details.trim() !== '') {
              articlesAvecDetails++;
            }
          });
        }
      } catch (error) {
        // Ignorer les erreurs pour continuer l'analyse
      }
      
      // Pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log('\n📈 STATISTIQUES ARTICLES LOCAUX:');
    console.log(`   📦 Total articles: ${totalArticles}`);
    console.log(`   📏 Avec dimensions: ${articlesAvecDimensions}/${totalArticles} (${((articlesAvecDimensions/totalArticles)*100).toFixed(1)}%)`);
    console.log(`   📸 Avec photos: ${articlesAvecPhotos}/${totalArticles} (${((articlesAvecPhotos/totalArticles)*100).toFixed(1)}%)`);
    console.log(`   🏷️ Avec catégories: ${articlesAvecCategories}/${totalArticles} (${((articlesAvecCategories/totalArticles)*100).toFixed(1)}%)`);
    console.log(`   📝 Avec détails: ${articlesAvecDetails}/${totalArticles} (${((articlesAvecDetails/totalArticles)*100).toFixed(1)}%)`);
  }

  async run(): Promise<void> {
    try {
      await this.authenticate();
      await this.analyzeArticleDetails();
      await this.analyzeAllArticles();
      
      console.log('\n💡 ACTIONS REQUISES:');
      console.log('   1. Migrer les dimensions détaillées des articles');
      console.log('   2. Transférer les photos des articles');
      console.log('   3. Restaurer les catégories spécifiques');
      console.log('   4. Préserver les détails descriptifs');

    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }
}

async function main() {
  const analyzer = new ArticleDataAnalyzer();
  await analyzer.run();
}

if (require.main === module) {
  main();
}

export { ArticleDataAnalyzer };