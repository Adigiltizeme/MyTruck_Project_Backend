import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class CommandeAnalyzer {
  private localToken: string = '';

  async authenticate(): Promise<void> {
    const localAuth = await axios.post(`${LOCAL_URL}/auth/login`, {
      email: 'admin@test.com',
      password: 'admin123'
    });
    this.localToken = localAuth.data.access_token;
    console.log('✅ Connexion locale réussie');
  }

  async analyzeCommandes(): Promise<void> {
    console.log('🔍 ANALYSE DÉTAILLÉE DES COMMANDES...');
    
    const headers = { Authorization: `Bearer ${this.localToken}` };
    
    // Récupérer toutes les commandes
    const commandesResponse = await axios.get(`${LOCAL_URL}/commandes?take=1000`, { headers });
    const commandes = commandesResponse.data.data;
    
    console.log(`\n📦 Total commandes: ${commandes.length}`);
    
    // Grouper par date pour identifier les périodes
    const commandesParMois = new Map();
    const commandesOrphelines = [];
    const commandesCompletes = [];
    
    for (const cmd of commandes) {
      const date = new Date(cmd.dateCommande);
      const moisCle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!commandesParMois.has(moisCle)) {
        commandesParMois.set(moisCle, []);
      }
      commandesParMois.get(moisCle).push(cmd);
      
      // Essayer de récupérer les détails de la commande
      try {
        const detailResponse = await axios.get(`${LOCAL_URL}/commandes/${cmd.id}`, { headers });
        const detail = detailResponse.data;
        
        if (detail.client && detail.magasin) {
          commandesCompletes.push({
            ...cmd,
            clientComplet: detail.client,
            magasinComplet: detail.magasin,
            chauffeurs: detail.chauffeurs || []
          });
        } else {
          commandesOrphelines.push(cmd);
        }
      } catch (error) {
        commandesOrphelines.push(cmd);
      }
      
      // Pause pour éviter de surcharger l'API
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('\n📅 RÉPARTITION PAR MOIS:');
    Array.from(commandesParMois.entries())
      .sort()
      .forEach(([mois, cmds]) => {
        console.log(`   ${mois}: ${cmds.length} commandes`);
      });
    
    console.log('\n📊 ÉTAT DES COMMANDES:');
    console.log(`   ✅ Complètes (avec client + magasin): ${commandesCompletes.length}`);
    console.log(`   ❌ Orphelines (données manquantes): ${commandesOrphelines.length}`);
    
    if (commandesCompletes.length > 0) {
      console.log('\n✅ ÉCHANTILLON COMMANDES COMPLÈTES:');
      commandesCompletes.slice(0, 3).forEach(cmd => {
        console.log(`   • ${cmd.numeroCommande} (${cmd.clientComplet?.nom || 'N/A'})`);
        console.log(`     Client: ${cmd.clientComplet?.nom} ${cmd.clientComplet?.prenom || ''}`);
        console.log(`     Magasin: ${cmd.magasinComplet?.nom || 'N/A'}`);
        console.log(`     Chauffeurs: ${cmd.chauffeurs?.length || 0}`);
      });
    }
    
    if (commandesOrphelines.length > 0) {
      console.log('\n❌ ÉCHANTILLON COMMANDES ORPHELINES:');
      commandesOrphelines.slice(0, 3).forEach(cmd => {
        console.log(`   • ${cmd.numeroCommande} (${new Date(cmd.dateCommande).toISOString().split('T')[0]})`);
        console.log(`     ClientID: ${cmd.clientId?.slice(0, 8)}...`);
        console.log(`     MagasinID: ${cmd.magasinId?.slice(0, 8)}...`);
      });
    }
    
    // Recommandations
    console.log('\n💡 RECOMMANDATIONS:');
    if (commandesCompletes.length > 0) {
      console.log(`   ✅ Migrer les ${commandesCompletes.length} commandes complètes en priorité`);
    }
    if (commandesOrphelines.length > 0) {
      console.log(`   🗑️  Considérer supprimer les ${commandesOrphelines.length} commandes orphelines (données de test)`);
      console.log(`   🔧 Ou créer des clients/magasins génériques pour ces commandes`);
    }
  }

  async run(): Promise<void> {
    try {
      await this.authenticate();
      await this.analyzeCommandes();
    } catch (error) {
      console.error('❌ Erreur:', error.message);
    }
  }
}

async function main() {
  const analyzer = new CommandeAnalyzer();
  await analyzer.run();
}

if (require.main === module) {
  main();
}

export { CommandeAnalyzer };