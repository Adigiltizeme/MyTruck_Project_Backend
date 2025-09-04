import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlotsService } from './slots.service';

@Injectable()
export class SlotsCron {
    constructor(private readonly slotsService: SlotsService) { }

    // Nettoyer les restrictions expirées tous les jours à 2h du matin
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async cleanupExpiredRestrictions() {
        console.log('🧹 Démarrage nettoyage automatique des restrictions expirées...');

        try {
            const result = await this.slotsService.cleanupExpiredRestrictions();
            console.log(`✅ Nettoyage terminé: ${result.count} restrictions supprimées`);
        } catch (error) {
            console.error('❌ Erreur lors du nettoyage:', error);
        }
    }
}
