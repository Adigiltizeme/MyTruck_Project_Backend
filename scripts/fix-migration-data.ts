import axios from 'axios';

const LOCAL_URL = 'http://localhost:3000/api/v1';
const PRODUCTION_URL = 'https://mytruckprojectbackend-production.up.railway.app/api/v1';

class MigrationFixer {
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

    // Mapper par ordre chronologique (plus fiable que les numéros)
    const maxIndex = Math.min(localSorted.length, prodSorted.length);
    for (let i = 0; i < maxIndex; i++) {
      const localCmd = localSorted[i];
      const prodCmd = prodSorted[i];
      
      mapping.set(`mapping_${i}`, {
        localId: localCmd.id,
        prodId: prodCmd.id,
        localCmd,
        prodCmd,
        localNum: localCmd.numeroCommande,
        prodNum: prodCmd.numeroCommande
      });
      
      if (i < 5) { // Debug pour les 5 premiers
        console.log(`   🔗 ${i}: ${localCmd.numeroCommande} -> ${prodCmd.numeroCommande}`);
      }
    }

    console.log(`   ✅ ${mapping.size} commandes mappées par ordre chronologique`);
    return mapping;
  }

  async fixStatuts(commandeMapping: Map<string, any>): Promise<void> {
    console.log('\n📊 CORRECTION DES STATUTS...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    let success = 0;
    let errors = 0;

    for (const [numeroCommande, mapping] of commandeMapping) {
      try {
        const { localCmd, prodId } = mapping;
        
        // Mise à jour uniquement si différent
        if (localCmd.statutCommande !== 'En attente' || localCmd.statutLivraison !== 'EN ATTENTE') {
          const updateData = {
            statutCommande: localCmd.statutCommande,
            statutLivraison: localCmd.statutLivraison
          };

          await axios.patch(`${PRODUCTION_URL}/commandes/${prodId}`, updateData, { headers: prodHeaders });
          console.log(`   ✅ ${numeroCommande}: ${localCmd.statutCommande} / ${localCmd.statutLivraison}`);
          success++;
        }
      } catch (error) {
        console.log(`   ❌ ${numeroCommande}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`📊 Statuts: ${success} corrigés, ${errors} erreurs`);
  }

  async getChauffeurMapping(): Promise<Map<string, string>> {
    console.log('\n👥 MAPPING DES CHAUFFEURS...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { Authorization: `Bearer ${this.productionToken}` };

    const [localChauffeurs, prodChauffeurs] = await Promise.all([
      axios.get(`${LOCAL_URL}/chauffeurs?take=100`, { headers: localHeaders }),
      axios.get(`${PRODUCTION_URL}/chauffeurs?take=100`, { headers: prodHeaders })
    ]);

    const mapping = new Map(); // localId -> prodId
    
    localChauffeurs.data.data.forEach(localCh => {
      const prodCh = prodChauffeurs.data.data.find(p => 
        p.nom === localCh.nom && p.prenom === localCh.prenom
      );
      if (prodCh) {
        mapping.set(localCh.id, prodCh.id);
        console.log(`   ✅ ${localCh.nom} ${localCh.prenom}: ${localCh.id} -> ${prodCh.id}`);
      }
    });

    console.log(`📊 Chauffeurs mappés: ${mapping.size}`);
    return mapping;
  }

  async fixChauffeurAssignments(commandeMapping: Map<string, any>, chauffeurMapping: Map<string, string>): Promise<void> {
    console.log('\n🚚 CORRECTION DES AFFECTATIONS CHAUFFEURS...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    let success = 0;
    let errors = 0;

    for (const [numeroCommande, mapping] of commandeMapping) {
      try {
        const { localId, prodId } = mapping;
        
        // Récupérer les détails de la commande locale
        const localDetail = await axios.get(`${LOCAL_URL}/commandes/${localId}`, { headers: localHeaders });
        const chauffeurs = localDetail.data.chauffeurs || [];
        
        if (chauffeurs.length > 0) {
          // Mapper les IDs des chauffeurs
          const chauffeurIds = [];
          for (const chAssignment of chauffeurs) {
            const chauffeursId = chAssignment.chauffeurId;
            const prodChauffeurId = chauffeurMapping.get(chauffeursId);
            if (prodChauffeurId) {
              chauffeurIds.push(prodChauffeurId);
            }
          }

          if (chauffeurIds.length > 0) {
            const assignData = {
              chauffeurIds,
              replaceAll: true
            };

            await axios.patch(`${PRODUCTION_URL}/commandes/${prodId}/assign-chauffeurs`, assignData, { headers: prodHeaders });
            console.log(`   ✅ ${numeroCommande}: ${chauffeurIds.length} chauffeurs assignés`);
            success++;
          }
        }
      } catch (error) {
        console.log(`   ❌ ${numeroCommande}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`📊 Affectations chauffeurs: ${success} corrigées, ${errors} erreurs`);
  }

  async fixCommandeDetails(commandeMapping: Map<string, any>): Promise<void> {
    console.log('\n🔧 CORRECTION DES DÉTAILS COMMANDES...');
    
    const localHeaders = { Authorization: `Bearer ${this.localToken}` };
    const prodHeaders = { 
      Authorization: `Bearer ${this.productionToken}`,
      'Content-Type': 'application/json'
    };

    let success = 0;
    let errors = 0;

    for (const [numeroCommande, mapping] of commandeMapping) {
      try {
        const { localId, prodId, localCmd } = mapping;
        
        // Récupérer les détails complets locaux
        const localDetail = await axios.get(`${LOCAL_URL}/commandes/${localId}`, { headers: localHeaders });
        const detail = localDetail.data;
        
        // Préparer les corrections
        const updates: any = {};
        
        // Option équipier si différente
        if (detail.optionEquipier && detail.optionEquipier !== 0) {
          updates.optionEquipier = detail.optionEquipier;
        }
        
        // Tarif HT si différent
        if (detail.tarifHT && parseFloat(detail.tarifHT) !== 0) {
          updates.tarifHT = parseFloat(detail.tarifHT);
        }

        // Réserve transport
        if (detail.reserveTransport !== undefined) {
          updates.reserveTransport = detail.reserveTransport;
        }

        // Catégorie véhicule
        if (detail.categorieVehicule) {
          updates.categorieVehicule = detail.categorieVehicule;
        }

        // Vendeur
        if (detail.prenomVendeur) {
          updates.prenomVendeur = detail.prenomVendeur;
        }

        // Remarques
        if (detail.remarques) {
          updates.remarques = detail.remarques;
        }

        if (Object.keys(updates).length > 0) {
          await axios.patch(`${PRODUCTION_URL}/commandes/${prodId}`, updates, { headers: prodHeaders });
          console.log(`   ✅ ${numeroCommande}: ${Object.keys(updates).length} champs corrigés`);
          success++;
        }
      } catch (error) {
        console.log(`   ❌ ${numeroCommande}: ${error.response?.data?.message || error.message}`);
        errors++;
      }
    }

    console.log(`📊 Détails commandes: ${success} corrigés, ${errors} erreurs`);
  }

  async runCompleteFixing(): Promise<void> {
    try {
      await this.authenticate();
      
      // 1. Construire le mapping des commandes
      const commandeMapping = await this.buildCommandeMapping();
      
      // 2. Corriger les statuts
      await this.fixStatuts(commandeMapping);
      
      // 3. Mapper et corriger les chauffeurs
      const chauffeurMapping = await this.getChauffeurMapping();
      await this.fixChauffeurAssignments(commandeMapping, chauffeurMapping);
      
      // 4. Corriger les autres détails
      await this.fixCommandeDetails(commandeMapping);
      
      console.log('\n✅ CORRECTION COMPLÈTE TERMINÉE !');
      console.log('\n📋 Les données suivantes ont été restaurées:');
      console.log('   ✅ Statuts réels des commandes et livraisons');
      console.log('   ✅ Affectations chauffeurs aux commandes');
      console.log('   ✅ Options équipiers');
      console.log('   ✅ Tarifs HT corrects');
      console.log('   ✅ Informations vendeurs et remarques');

    } catch (error) {
      console.error('❌ Erreur globale:', error.message);
    }
  }
}

async function main() {
  const fixer = new MigrationFixer();
  await fixer.runCompleteFixing();
}

if (require.main === module) {
  main();
}

export { MigrationFixer };