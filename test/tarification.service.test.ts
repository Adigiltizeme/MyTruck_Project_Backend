import { TarificationService } from '../../frontend/src/services/tarification.service';
import { MapboxService } from '../../frontend/src/services/mapbox.service';

// Mock du service Mapbox
jest.mock('../src/services/mapbox.service');

describe('TarificationService', () => {
    let service: TarificationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new TarificationService();

        // Configuration du mock pour les tests
        (MapboxService.prototype.calculateDistance as jest.Mock).mockImplementation(
            (origin: string, destination: string) => {
                // Simuler différentes distances selon les adresses
                if (origin.includes('Paris') && destination.includes('Paris')) {
                    return Promise.resolve(5); // Courte distance dans Paris
                } else if (origin.includes('Batignolles')) {
                    return Promise.resolve(0); // Zone forfait Paris
                } else if (destination.includes('Lyon')) {
                    return Promise.resolve(60); // Longue distance (devis)
                } else {
                    return Promise.resolve(25); // Distance moyenne
                }
            }
        );
    });

    test('devrait calculer correctement le tarif pour un véhicule 3M3 avec 1 équipier', async () => {
        const params = {
            vehicule: '3M3',
            adresseMagasin: 'Rue quelconque, Paris',
            adresseLivraison: 'Avenue xyz, Paris',
            equipiers: 1
        };

        const result = await service.calculerTarif(params);

        expect(result.montantHT).toBe(60); // 38 (véhicule) + 22 (équipier) + 0 (distance Paris)
        expect(result.detail.vehicule).toBe(38);
        expect(result.detail.equipiers).toBe(22);
    });

    test('devrait requérir un devis pour plus de 2 équipiers', async () => {
        const params = {
            vehicule: '3M3',
            adresseMagasin: 'Rue quelconque, Paris',
            adresseLivraison: 'Avenue xyz, Paris',
            equipiers: 3
        };

        const result = await service.calculerTarif(params);

        expect(result.montantHT).toBe('devis');
        expect(result.detail.equipiers).toBe('devis');
    });

    test('devrait appliquer les frais kilométriques correctement', async () => {
        const params = {
            vehicule: '6M3',
            adresseMagasin: 'Rue quelconque, Marseille',
            adresseLivraison: 'Avenue xyz, Toulon',
            equipiers: 1
        };

        const result = await service.calculerTarif(params);

        // Distance de 25km, donc frais de 16€ (tranche 20-30km)
        expect(result.montantHT).toBe(84); // 46 (véhicule) + 22 (équipier) + 16 (distance)
        expect(result.detail.distance).toBe(16);
    });

    test('devrait calculer correctement les frais kilométriques pour distance >40km', async () => {
        const params = {
            vehicule: '10M3',
            adresseMagasin: 'Rue quelconque, Paris',
            adresseLivraison: 'Avenue xyz, Marseille',
            equipiers: 1
        };

        // Simuler une distance de 45km
        (MapboxService.prototype.calculateDistance as jest.Mock).mockResolvedValueOnce(45);

        const result = await service.calculerTarif(params);

        // Vérifier que les frais kilométriques sont de 32€ (corrigés de 36€)
        expect(result.detail.distance).toBe(32);
        expect(result.montantHT).toBe(54 + 22 + 32); // véhicule + équipier + frais kilométriques
    });

    test('devrait retourner un devis pour une distance supérieure à 50km', async () => {
        const params = {
            vehicule: '10M3',
            adresseMagasin: 'Rue quelconque, Paris',
            adresseLivraison: 'Avenue xyz, Lyon',
            equipiers: 1
        };

        const result = await service.calculerTarif(params);

        expect(result.montantHT).toBe('devis');
        expect(result.detail.distance).toBe('devis');
    });

    test('devrait appliquer le forfait Paris pour les magasins concernés', async () => {
        const params = {
            vehicule: '3M3',
            adresseMagasin: 'Rue quelconque, Batignolles',
            adresseLivraison: 'Avenue xyz, Saint-Denis',
            equipiers: 0
        };

        const result = await service.calculerTarif(params);

        expect(result.montantHT).toBe(38); // 38 (véhicule) + 0 (équipier) + 0 (forfait Paris)
        expect(result.detail.distance).toBe(0);
    });
});