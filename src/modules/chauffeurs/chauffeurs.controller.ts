import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    ParseUUIDPipe,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';

import { ChauffeursService } from './chauffeurs.service';
import { CreateChauffeurDto, UpdateChauffeurDto, ChauffeurFiltersDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Chauffeurs')
@Controller('chauffeurs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ChauffeursController {
    constructor(private readonly chauffeursService: ChauffeursService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Créer un chauffeur',
        description: 'Crée un nouveau chauffeur (Admin/Direction uniquement)'
    })
    @ApiResponse({ status: 201, description: 'Chauffeur créé avec succès' })
    @ApiResponse({ status: 403, description: 'Accès interdit' })
    async create(@Body() createChauffeurDto: CreateChauffeurDto) {
        return this.chauffeursService.create(createChauffeurDto);
    }

    @Get()
    @ApiOperation({
        summary: 'Lister les chauffeurs',
        description: 'Récupère la liste des chauffeurs avec filtres et pagination'
    })
    @ApiResponse({ status: 200, description: 'Liste des chauffeurs récupérée avec succès' })
    async findAll(@Query() filters: ChauffeurFiltersDto) {
        return this.chauffeursService.findAll(filters);
    }

    @Get('available')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({
        summary: 'Chauffeurs disponibles',
        description: 'Récupère les chauffeurs disponibles pour une date donnée'
    })
    @ApiQuery({
        name: 'dateLivraison',
        type: 'string',
        description: 'Date de livraison (YYYY-MM-DD)',
        required: true
    })
    @ApiQuery({
        name: 'excludeIds',
        type: 'string',
        description: 'IDs à exclure (séparés par des virgules)',
        required: false
    })
    @ApiResponse({ status: 200, description: 'Chauffeurs disponibles récupérés avec succès' })
    async findAvailable(
        @Query('dateLivraison') dateLivraison: string,
        @Query('excludeIds') excludeIds?: string
    ) {
        const date = new Date(dateLivraison);
        const excludeList = excludeIds ? excludeIds.split(',') : [];

        return this.chauffeursService.findAvailableDrivers(date, excludeList);
    }

    @Get('by-status/:status')
    @ApiOperation({
        summary: 'Chauffeurs par statut',
        description: 'Récupère les chauffeurs d\'un statut spécifique'
    })
    @ApiResponse({ status: 200, description: 'Chauffeurs récupérés avec succès' })
    async findByStatus(@Param('status') status: string) {
        return this.chauffeursService.findByStatus(status);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Détails d\'un chauffeur',
        description: 'Récupère les détails d\'un chauffeur avec ses assignations récentes'
    })
    @ApiResponse({
        status: 200,
        description: 'Chauffeur trouvé',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                nom: { type: 'string' },
                prenom: { type: 'string' },
                telephone: { type: 'string' },
                email: { type: 'string' },
                status: { type: 'string' },
                notes: { type: 'number' },
                longitude: { type: 'number' },
                latitude: { type: 'number' },
                assignations: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            commande: {
                                type: 'object',
                                properties: {
                                    numeroCommande: { type: 'string' },
                                    dateLivraison: { type: 'string' },
                                    statutLivraison: { type: 'string' }
                                }
                            }
                        }
                    }
                },
                _count: {
                    type: 'object',
                    properties: {
                        assignations: { type: 'number' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.chauffeursService.findOne(id);
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: 'Statistiques d\'un chauffeur',
        description: 'Récupère les statistiques détaillées d\'un chauffeur'
    })
    @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    async getStats(@Param('id', ParseUUIDPipe) id: string) {
        return this.chauffeursService.getChauffeurStats(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Modifier un chauffeur',
        description: 'Met à jour les informations d\'un chauffeur'
    })
    @ApiResponse({ status: 200, description: 'Chauffeur mis à jour avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateChauffeurDto: UpdateChauffeurDto
    ) {
        return this.chauffeursService.update(id, updateChauffeurDto);
    }

    @Patch(':id/position')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHAUFFEUR)
    @ApiOperation({
        summary: 'Mettre à jour la position',
        description: 'Met à jour la position GPS d\'un chauffeur'
    })
    @ApiResponse({ status: 200, description: 'Position mise à jour avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    async updatePosition(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() positionData: { longitude: number; latitude: number }
    ) {
        return this.chauffeursService.updatePosition(
            id,
            positionData.longitude,
            positionData.latitude
        );
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: 'Supprimer un chauffeur',
        description: 'Supprime un chauffeur (Admin uniquement)'
    })
    @ApiResponse({ status: 200, description: 'Chauffeur supprimé avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    @ApiResponse({ status: 400, description: 'Impossible de supprimer: assignations actives' })
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.chauffeursService.remove(id);
    }
}