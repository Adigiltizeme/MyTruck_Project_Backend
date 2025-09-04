import { Injectable } from "@nestjs/common";

@Injectable()
export class VehicleValidationBackendService {

    /**
     * 🎯 Calcule les équipiers requis côté backend
     * Même logique que le frontend mais en TypeScript backend
     */
    calculateRequiredCrewSize(
        articles: { poids?: number; quantite?: number }[],
        deliveryConditions: {
            hasElevator?: boolean;
            totalItemCount?: number;
            rueInaccessible?: boolean;
            paletteComplete?: boolean;
            parkingDistance?: number;
            hasStairs?: boolean;
            stairCount?: number;
            needsAssembly?: boolean;
            floor?: number;
            isDuplex?: boolean;
            deliveryToUpperFloor?: boolean;
        }
    ): number {
        if (!articles || articles.length === 0) return 0;

        // Article le plus lourd individuellement
        const heaviestWeight = Math.max(...articles.map(a => a.poids || 0));

        // Poids total avec quantités
        const totalWeight = articles.reduce((sum, article) =>
            sum + ((article.poids || 0) * (article.quantite || 1)), 0
        );

        // Étage effectif avec duplex
        let effectiveFloor = deliveryConditions.floor || 0;
        if (deliveryConditions.isDuplex && deliveryConditions.deliveryToUpperFloor) {
            effectiveFloor += 1;
        }

        let totalRequiredCrew = 0;
        const triggeredConditions: string[] = [];

        // 🔥 MÊME LOGIQUE QUE LE FRONTEND - Cumul des conditions

        // Condition 1: Article ≥30kg
        if (heaviestWeight >= 30) {
            totalRequiredCrew += 1;
            triggeredConditions.push(`Article lourd: ${heaviestWeight}kg`);
        }

        // Condition 2: Charge >300kg avec ascenseur
        if (deliveryConditions.hasElevator && totalWeight > 300) {
            totalRequiredCrew += 1;
            triggeredConditions.push(`Charge lourde avec ascenseur: ${totalWeight}kg`);
        }

        // Condition 3: Charge >200kg sans ascenseur
        if (!deliveryConditions.hasElevator && totalWeight > 200) {
            totalRequiredCrew += 1;
            triggeredConditions.push(`Charge lourde sans ascenseur: ${totalWeight}kg`);
        }

        // Condition 4: Plus de 20 articles
        if ((deliveryConditions.totalItemCount || 0) > 20) {
            totalRequiredCrew += 1;
            triggeredConditions.push(`Nombreux articles: ${deliveryConditions.totalItemCount}`);
        }

        // Condition 5: Rue inaccessible
        if (deliveryConditions.rueInaccessible) {
            totalRequiredCrew += 1;
            triggeredConditions.push('Rue inaccessible');
        }

        // Condition 6: Palette complète
        if (deliveryConditions.paletteComplete) {
            totalRequiredCrew += 1;
            triggeredConditions.push('Palette complète');
        }

        // Conditions supplémentaires
        if ((deliveryConditions.parkingDistance || 0) > 50) {
            totalRequiredCrew += 1;
            triggeredConditions.push(`Distance portage: ${deliveryConditions.parkingDistance}m`);
        }

        if (effectiveFloor > 2 && !deliveryConditions.hasElevator) {
            totalRequiredCrew += 1;
            triggeredConditions.push(`Étage élevé: ${effectiveFloor}ème sans ascenseur`);
        }

        if (deliveryConditions.hasStairs && (deliveryConditions.stairCount || 0) > 20) {
            totalRequiredCrew += 1;
            triggeredConditions.push(`Nombreuses marches: ${deliveryConditions.stairCount}`);
        }

        if (deliveryConditions.needsAssembly) {
            totalRequiredCrew += 1;
            triggeredConditions.push('Montage nécessaire');
        }

        return totalRequiredCrew;
    }

    /**
     * 🎯 Validation complète d'une commande
     */
    validateCommande(commandeData: any): {
        requiredCrewSize: number;
        heaviestArticle: number;
        totalWeight: number;
        totalItems: number;
        triggeredConditions: string[];
        needsQuote: boolean;
        validationDetails: any;
    } {
        const articles = commandeData.dimensionsArticles || [];
        const totalItemCount = articles.reduce((sum, article) => sum + (article.quantite || 1), 0);

        const deliveryConditions = {
            hasElevator: commandeData.clientAscenseur || false,
            totalItemCount,
            rueInaccessible: commandeData.rueInaccessible || false,
            paletteComplete: commandeData.paletteComplete || false,
            parkingDistance: commandeData.parkingDistance || 0,
            hasStairs: commandeData.hasStairs || false,
            stairCount: commandeData.stairCount || 0,
            needsAssembly: commandeData.needsAssembly || false,
            floor: parseInt(commandeData.clientEtage || '0'),
            isDuplex: commandeData.isDuplex || false,
            deliveryToUpperFloor: commandeData.deliveryToUpperFloor || false
        };

        const requiredCrewSize = this.calculateRequiredCrewSize(articles, deliveryConditions);
        const heaviestArticle = Math.max(...articles.map(a => a.poids || 0));
        const totalWeight = articles.reduce((sum, article) =>
            sum + ((article.poids || 0) * (article.quantite || 1)), 0
        );

        const needsQuote = requiredCrewSize >= 3 || totalWeight > 800;

        return {
            requiredCrewSize,
            heaviestArticle,
            totalWeight,
            totalItems: totalItemCount,
            triggeredConditions: [], // À implémenter selon besoins
            needsQuote,
            validationDetails: {
                deliveryConditions,
                calculatedAt: new Date().toISOString()
            }
        };
    }
}