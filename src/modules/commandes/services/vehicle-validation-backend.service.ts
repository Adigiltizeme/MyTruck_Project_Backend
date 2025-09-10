import { Injectable } from "@nestjs/common";

@Injectable()
export class VehicleValidationBackendService {

    /**
     * 🎯 NOUVELLE LOGIQUE HIÉRARCHIQUE NON-CUMULATIVE (Backend)
     * Identique au frontend pour cohérence totale
     */
    calculateRequiredCrewSize(
        articles: { poids?: number; quantite?: number; categories?: string[] }[],
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
            estimatedHandlingTime?: number;
            hasLargeVoluminousItems?: boolean;
            multipleLargeVoluminousItems?: boolean;
            complexAccess?: boolean;
        }
    ): number {
        if (!articles || articles.length === 0) return 0;

        // 🔍 CALCULS DE BASE
        let heaviestIndividualWeight = 0;
        articles.forEach(article => {
            const poids = article.poids || 0;
            if (poids > heaviestIndividualWeight) {
                heaviestIndividualWeight = poids;
            }
        });

        const totalWeight = articles.reduce((sum, article) =>
            sum + ((article.poids || 0) * (article.quantite || 1)), 0
        );

        const totalItemCount = deliveryConditions.totalItemCount ||
            articles.reduce((sum, article) => sum + (article.quantite || 1), 0);

        // Calculer l'étage effectif
        let effectiveFloor = deliveryConditions.floor || 0;
        if (deliveryConditions.isDuplex && deliveryConditions.deliveryToUpperFloor) {
            effectiveFloor += 1;
        }

        // Identifier les articles type plantes/terreaux/pots
        const plantArticleCount = articles.reduce((sum, article) => {
            const isPlantRelated = article.categories?.some(cat => 
                cat.toLowerCase().includes('plante') || 
                cat.toLowerCase().includes('terreau') || 
                cat.toLowerCase().includes('pot')
            ) || false;
            return sum + (isPlantRelated ? (article.quantite || 1) : 0);
        }, 0);

        // 🔥 NIVEAU 3: DEVIS OBLIGATOIRE (≥3 équipiers) - PRIORITÉ MAXIMALE
        
        // Article ≥90kg
        if (heaviestIndividualWeight >= 90) {
            return 3;
        }

        // 3+ étages sans ascenseur avec ≥40 articles plantes/terreaux/pots
        if (effectiveFloor >= 3 && !deliveryConditions.hasElevator && plantArticleCount >= 40) {
            return 3;
        }

        // Palette + accès compliqué
        if (deliveryConditions.paletteComplete && deliveryConditions.complexAccess) {
            return 3;
        }

        // Plusieurs gros sujets volumineux
        if (deliveryConditions.multipleLargeVoluminousItems) {
            return 3;
        }

        // Manutention >45min
        if ((deliveryConditions.estimatedHandlingTime || 0) > 45) {
            return 3;
        }

        // 🟡 NIVEAU 2: +2 ÉQUIPIERS (3 personnes total)
        
        // Article ≥60kg et <90kg
        if (heaviestIndividualWeight >= 60 && heaviestIndividualWeight < 90) {
            return 2;
        }

        // ≥3 étages sans ascenseur avec ≥30 articles plantes/terreaux/pots
        if (effectiveFloor >= 3 && !deliveryConditions.hasElevator && plantArticleCount >= 30) {
            return 2;
        }

        // Palette à dépalettiser + montage en étage
        if (deliveryConditions.paletteComplete && effectiveFloor > 0) {
            return 2;
        }

        // Gros sujets volumineux
        if (deliveryConditions.hasLargeVoluminousItems) {
            return 2;
        }

        // Manutention ≥30min et ≤45min
        if ((deliveryConditions.estimatedHandlingTime || 0) >= 30 && (deliveryConditions.estimatedHandlingTime || 0) <= 45) {
            return 2;
        }

        // 🟢 NIVEAU 1: +1 ÉQUIPIER (2 personnes total)
        
        // Article ≥30kg et <60kg (priorité sur charge totale)
        if (heaviestIndividualWeight >= 30 && heaviestIndividualWeight < 60) {
            return 1;
        }

        // Charge totale lourde (SEULEMENT si pas d'article ≥30kg individuel)
        if (heaviestIndividualWeight < 30 && 
            ((deliveryConditions.hasElevator && totalWeight >= 300) || 
             (!deliveryConditions.hasElevator && totalWeight >= 200))) {
            return 1;
        }

        // Étage élevé sans ascenseur (≥2ème étage) avec nombreux articles (≥20)
        if (effectiveFloor >= 2 && !deliveryConditions.hasElevator && totalItemCount >= 20) {
            return 1;
        }

        // Nombreux articles (≥20) - SEULEMENT si pas d'étage sans ascenseur
        if (totalItemCount >= 20 && (deliveryConditions.hasElevator || effectiveFloor < 2)) {
            return 1;
        }

        // Rue inaccessible
        if (deliveryConditions.rueInaccessible) {
            return 1;
        }

        // Palette complète simple (rez-de-chaussée uniquement)
        if (deliveryConditions.paletteComplete && effectiveFloor === 0) {
            return 1;
        }

        // Distance de portage ≥50m
        if ((deliveryConditions.parkingDistance || 0) >= 50) {
            return 1;
        }

        // Nombreuses marches ≥20
        if (deliveryConditions.hasStairs && (deliveryConditions.stairCount || 0) >= 20) {
            return 1;
        }

        // Montage/installation standard
        if (deliveryConditions.needsAssembly) {
            return 1;
        }

        // 🔵 AUCUNE CONDITION = CHAUFFEUR SEUL
        return 0;
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