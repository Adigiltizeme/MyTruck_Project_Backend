import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateStatusHistory() {
    console.log('🔄 Migration historique des statuts...');

    try {
        // Récupérer toutes les commandes existantes
        const commandes = await prisma.commande.findMany({
            select: {
                id: true,
                numeroCommande: true,
                dateCommande: true,
                statutCommande: true,
                statutLivraison: true,
                updatedAt: true,
                statusHistory: {
                    select: { id: true }
                }
            }
        });

        console.log(`📊 ${commandes.length} commandes trouvées`);

        let migratedCount = 0;

        for (const commande of commandes) {
            // Vérifier si cette commande a déjà un historique
            if (commande.statusHistory.length > 0) {
                console.log(`⏭️  Commande ${commande.numeroCommande} a déjà un historique`);
                continue;
            }

            // Créer les entrées d'historique initiales
            const historyEntries = [];

            // 1. Entrée pour le statut de commande (à la création)
            historyEntries.push({
                commandeId: commande.id,
                statusType: 'COMMANDE' as const,
                oldStatus: 'Nouveau', // Statut initial hypothétique
                newStatus: commande.statutCommande,
                changedBy: 'system-migration',
                changedAt: commande.dateCommande,
                reason: 'Migration historique initial'
            });

            // 2. Entrée pour le statut de livraison initial
            historyEntries.push({
                commandeId: commande.id,
                statusType: 'LIVRAISON' as const,
                oldStatus: 'NOUVEAU', // Statut initial hypothétique
                newStatus: commande.statutLivraison,
                changedBy: 'system-migration',
                changedAt: commande.dateCommande,
                reason: 'Migration historique initial'
            });

            // Si le statut n'est pas "EN ATTENTE", ajouter une entrée plus récente
            if (commande.statutLivraison !== 'EN ATTENTE') {
                historyEntries.push({
                    commandeId: commande.id,
                    statusType: 'LIVRAISON' as const,
                    oldStatus: 'EN ATTENTE',
                    newStatus: commande.statutLivraison,
                    changedBy: 'system-migration',
                    changedAt: commande.updatedAt,
                    reason: 'Migration statut actuel'
                });
            }

            // Créer les entrées d'historique
            await prisma.statusHistory.createMany({
                data: historyEntries
            });

            migratedCount++;
            console.log(`✅ Commande ${commande.numeroCommande} - ${historyEntries.length} entrées créées`);
        }

        console.log(`🎉 Migration terminée : ${migratedCount} commandes migrées`);

    } catch (error) {
        console.error('❌ Erreur migration:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Exécuter la migration
migrateStatusHistory()
    .catch(console.error);