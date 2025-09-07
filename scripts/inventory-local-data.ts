import { PrismaClient } from '@prisma/client';

class DataInventory {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async getFullInventory(): Promise<void> {
    console.log('📊 INVENTAIRE COMPLET DES DONNÉES LOCALES');
    console.log('='.repeat(50));

    try {
      // Compter tous les enregistrements
      const counts = await Promise.all([
        this.prisma.user.count(),
        this.prisma.magasin.count(),
        this.prisma.client.count(),
        this.prisma.chauffeur.count(),
        this.prisma.commande.count(),
        this.prisma.slot.count(),
        this.prisma.document.count(),
        // Autres tables si elles existent
        this.countTableIfExists('devis'),
        this.countTableIfExists('facture'),
        this.countTableIfExists('rapportEnlevement'),
        this.countTableIfExists('rapportLivraison'),
        this.countTableIfExists('trackingEvent'),
      ]);

      console.log('\n📋 COMPTAGE GÉNÉRAL:');
      console.log(`   👥 Utilisateurs système: ${counts[0]}`);
      console.log(`   🏪 Magasins: ${counts[1]}`);
      console.log(`   🏢 Clients: ${counts[2]}`);
      console.log(`   🚚 Chauffeurs: ${counts[3]}`);
      console.log(`   📦 Commandes: ${counts[4]}`);
      console.log(`   📅 Créneaux: ${counts[5]}`);
      console.log(`   📄 Documents: ${counts[6]}`);
      console.log(`   💰 Devis: ${counts[7] || 0}`);
      console.log(`   🧾 Factures: ${counts[8] || 0}`);
      console.log(`   📋 Rapports enlèvement: ${counts[9] || 0}`);
      console.log(`   📋 Rapports livraison: ${counts[10] || 0}`);
      console.log(`   🛣️  Événements tracking: ${counts[11] || 0}`);

      // Détails des commandes
      if (counts[4] > 0) {
        console.log('\n📦 DÉTAILS COMMANDES:');
        const commandes = await this.prisma.commande.findMany({
          take: 5,
          include: {
            client: true,
            magasin: true,
            chauffeurs: true,
            slot: true,
            documents: true
          },
          orderBy: { createdAt: 'desc' }
        });

        console.log(`   📊 Échantillon de ${Math.min(5, commandes.length)} commandes récentes:`);
        commandes.forEach(cmd => {
          console.log(`     • ${cmd.numeroCommande} - ${cmd.client?.nom || 'Client inconnu'} - ${cmd.statut}`);
          console.log(`       Magasin: ${cmd.magasin?.nom || 'N/A'}`);
          console.log(`       Chauffeurs: ${cmd.chauffeurs?.length || 0}`);
          console.log(`       Documents: ${cmd.documents?.length || 0}`);
        });

        // Statuts des commandes
        const statutsCommandes = await this.prisma.commande.groupBy({
          by: ['statut'],
          _count: { statut: true }
        });
        console.log('\n   📈 Répartition par statut:');
        statutsCommandes.forEach(stat => {
          console.log(`     • ${stat.statut}: ${stat._count.statut} commandes`);
        });
      }

      // Détails des clients
      if (counts[2] > 0) {
        console.log('\n🏢 DÉTAILS CLIENTS:');
        const clients = await this.prisma.client.findMany({
          take: 5,
          include: {
            commandes: true
          },
          orderBy: { createdAt: 'desc' }
        });

        console.log(`   📊 Échantillon de ${Math.min(5, clients.length)} clients récents:`);
        clients.forEach(client => {
          console.log(`     • ${client.nom} ${client.prenom || ''} (${client.entreprise || 'Particulier'})`);
          console.log(`       Email: ${client.email || 'N/A'}, Tél: ${client.telephone || 'N/A'}`);
          console.log(`       Commandes: ${client.commandes?.length || 0}`);
        });
      }

      // Relations importantes
      console.log('\n🔗 VÉRIFICATION DES RELATIONS:');
      const commandesAvecRelations = await this.prisma.commande.count({
        where: {
          AND: [
            { clientId: { not: null } },
            { magasinId: { not: null } }
          ]
        }
      });
      console.log(`   📦 Commandes avec client ET magasin: ${commandesAvecRelations}/${counts[4]}`);

      const commandesAvecChauffeurs = await this.prisma.commande.count({
        where: {
          chauffeurs: {
            some: {}
          }
        }
      });
      console.log(`   🚚 Commandes avec chauffeurs assignés: ${commandesAvecChauffeurs}/${counts[4]}`);

      const commandesAvecDocuments = await this.prisma.commande.count({
        where: {
          documents: {
            some: {}
          }
        }
      });
      console.log(`   📄 Commandes avec documents: ${commandesAvecDocuments}/${counts[4]}`);

      console.log('\n✅ Inventaire terminé !');

    } catch (error) {
      console.error('❌ Erreur lors de l\'inventaire:', error.message);
    }
  }

  private async countTableIfExists(tableName: string): Promise<number> {
    try {
      const count = await (this.prisma as any)[tableName].count();
      return count;
    } catch (error) {
      return 0;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Exécution
async function main() {
  const inventory = new DataInventory();
  
  try {
    await inventory.getFullInventory();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await inventory.disconnect();
  }
}

if (require.main === module) {
  main();
}

export { DataInventory };