import { ApiProperty } from '@nestjs/swagger';

export class MagasinStatsResponseDto {
    @ApiProperty({
        description: 'Informations de base du magasin',
        type: 'object',
        properties: {
            id: { type: 'string' },
            nom: { type: 'string' }
        }
    })
    magasin: {
        id: string;
        nom: string;
    };

    @ApiProperty({
        description: 'Totaux généraux',
        type: 'object',
        properties: {
            users: { type: 'number' },
            commandes: { type: 'number' },
            factures: { type: 'number' },
            devis: { type: 'number' },
            cessionsOrigine: { type: 'number' },
            cessionsDestination: { type: 'number' }
        }
    })
    totaux: {
        users: number;
        commandes: number;
        factures: number;
        devis: number;
        cessionsOrigine: number;
        cessionsDestination: number;
    };

    @ApiProperty({
        description: 'Statistiques des commandes',
        type: 'object',
        properties: {
            parStatut: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        statut: { type: 'string' },
                        nombre: { type: 'number' }
                    }
                }
            }
        }
    })
    commandes: {
        parStatut: Array<{
            statut: string;
            nombre: number;
        }>;
    };

    @ApiProperty({
        description: 'Statistiques des livraisons',
        type: 'object',
        properties: {
            parStatut: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        statut: { type: 'string' },
                        nombre: { type: 'number' }
                    }
                }
            }
        }
    })
    livraisons: {
        parStatut: Array<{
            statut: string;
            nombre: number;
        }>;
    };

    @ApiProperty({
        description: 'Données financières',
        type: 'object',
        properties: {
            chiffreAffairesTotalHT: { type: 'number' },
            chiffreAffairesMoyenHT: { type: 'number' }
        }
    })
    financier: {
        chiffreAffairesTotalHT: number;
        chiffreAffairesMoyenHT: number;
    };

    @ApiProperty({
        description: 'Indicateurs de performance',
        type: 'object',
        properties: {
            tauxReussite: { type: 'number' },
            commandesMoyennesParMois: { type: 'number' }
        }
    })
    performance: {
        tauxReussite: number;
        commandesMoyennesParMois: number;
    };
}