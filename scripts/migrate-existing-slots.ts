import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateExistingSlots() {
    console.log('🔄 Migration des créneaux existants...');

    try {
        // Récupérer toutes les commandes avec des créneaux
        const commandes = await prisma.commande.findMany({
            where: {
                creneauLivraison: { not: null }
            },
            select: {
                id: true,
                creneauLivraison: true
            }
        });

        console.log(`📋 ${commandes.length} commandes à migrer`);

        // Récupérer tous les créneaux disponibles
        const timeSlots = await prisma.timeSlot.findMany();
        const slotsMap = new Map(
            timeSlots.map(slot => [slot.displayName, slot.id])
        );

        let migratedCount = 0;

        for (const commande of commandes) {
            if (commande.creneauLivraison) {
                const timeSlotId = slotsMap.get(commande.creneauLivraison);

                if (timeSlotId) {
                    await prisma.commande.update({
                        where: { id: commande.id },
                        data: { timeSlotId }
                    });
                    migratedCount++;
                } else {
                    console.warn(`⚠️ Créneau non trouvé: ${commande.creneauLivraison} pour commande ${commande.id}`);
                }
            }
        }

        console.log(`✅ Migration terminée: ${migratedCount}/${commandes.length} commandes migrées`);

    } catch (error) {
        console.error('❌ Erreur migration:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    migrateExistingSlots();
}

export { migrateExistingSlots };