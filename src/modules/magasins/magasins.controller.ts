import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { MagasinsService } from './magasins.service';
import { PrismaService } from 'prisma/prisma.service';

@ApiTags('magasins')
@Controller('magasins')
// @UseGuards(RolesGuard)

export class MagasinsController {
    constructor(
        private readonly magasinsService: MagasinsService,
        private readonly prisma: PrismaService
    ) {}

    @Get()
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Récupérer tous les magasins' })
    @ApiResponse({ status: 200, description: 'Liste des magasins récupérée avec succès' })
    async findAll() {
        console.log('🏪 GET /magasins appelé avec auth');
        return await this.prisma.magasin.findMany({
        select: {
            id: true,
            nom: true,
            adresse: true,
            telephone: true,
            email: true,
            manager: true,
            status: true
        }
    });
    }

    @Get(':id')
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    async findOne(@Param('id') id: string) {
        // ✅ DONNÉES TEMPORAIRES cohérentes
        console.log('🏪 GET /magasins/:id appelé pour:', id);
        const magasins = [
            { id: 'mag1', nom: 'Truffaut Boulogne', adresse: '33 Av. Edouard Vaillant, 92100 Boulogne-Billancourt' },
            { id: 'mag2', nom: 'Truffaut Ivry', adresse: '36 Rue Ernest Renan, 94200 Ivry-sur-Seine' }
        ];

        return magasins.find(m => m.id === id) || {
            id: id,
            nom: 'Magasin Test',
            adresse: 'Adresse test'
        };

    }

    @Post()
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    async create(@Body() createMagasinDto: any) {
        return {
            id: 'new-mag',
            ...createMagasinDto
        };
    }

    @Post('seed')
    // @UseGuards(RolesGuard)
    // @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Créer les magasins de base (dev uniquement)' })
    async seedMagasins() {
        try {
            console.log('🌱 Création des magasins de base...');

            const magasin1 = await this.magasinsService.create({
                nom: 'Truffaut Boulogne',
                adresse: '33 Av. Edouard Vaillant, 92100 Boulogne-Billancourt',
                telephone: '01 23 45 67 89',
                email: 'boulogne@truffaut.com',
                manager: 'Marie Dupont',
                status: 'actif'
            });

            const magasin2 = await this.magasinsService.create({
                nom: 'Truffaut Ivry',
                adresse: '36 Rue Ernest Renan, 94200 Ivry-sur-Seine',
                telephone: '01 98 76 54 32',
                email: 'ivry@truffaut.com',
                manager: 'Jean Martin',
                status: 'actif'
            });

            console.log('✅ Magasins créés:', { magasin1: magasin1.id, magasin2: magasin2.id });

            return {
                message: 'Magasins créés avec succès',
                magasins: [magasin1, magasin2]
            };

        } catch (error) {
            console.error('❌ Erreur création magasins:', error);
            throw error;
        }
    }

    @Get('test/creation')
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({ summary: 'Test données pour création commande' })
    async getTestData() {
        return {
            magasins: [
                { id: 'mag1', nom: 'Truffaut Boulogne', adresse: '33 Av. Edouard Vaillant, 92100 Boulogne' },
                { id: 'mag2', nom: 'Truffaut Ivry', adresse: '36 Rue Ernest Renan, 94200 Ivry' }
            ],
            creneaux: ['9h-12h', '14h-18h', '9h-18h'],
            vehicules: ['Camion', 'Camionnette', 'Véhicule léger']
        };
    }
}