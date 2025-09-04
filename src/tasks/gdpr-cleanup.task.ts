import { GDPRComplianceService } from "@/common/services/gdpr-compliance.service";
import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule/dist/decorators/cron.decorator";
import { CronExpression } from "@nestjs/schedule/dist/enums/cron-expression.enum";

@Injectable()
export class GDPRCleanupTask {
    constructor(private readonly gdprService: GDPRComplianceService) { }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async handleGDPRCleanup() {
        console.log('🔒 Début du nettoyage RGPD automatique');

        try {
            await this.gdprService.checkDataRetention();
            console.log('✅ Nettoyage RGPD terminé');
        } catch (error) {
            console.error('❌ Erreur lors du nettoyage RGPD:', error);
        }
    }
}