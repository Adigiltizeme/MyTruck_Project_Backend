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
    Request,
    UnauthorizedException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';

import { ChauffeursService } from './chauffeurs.service';
import { CreateChauffeurDto, UpdateChauffeurDto, ChauffeurFiltersDto, UpdateChauffeurPasswordDto, GeneratePasswordDto } from './dto';
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

    @Get(':id/dependencies')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Voir les dépendances d\'un chauffeur',
        description: 'Affiche la liste détaillée des éléments liés à un chauffeur avant suppression'
    })
    @ApiResponse({ status: 200, description: 'Dépendances récupérées avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    async getDependencies(@Param('id', ParseUUIDPipe) id: string) {
        console.log('🔍 GET /chauffeurs/:id/dependencies pour:', id);
        return this.chauffeursService.getDependencies(id);
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
    @ApiOperation({ summary: 'Supprimer un chauffeur' })
    @ApiResponse({ status: 200, description: 'Chauffeur supprimé avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    @ApiResponse({ status: 400, description: 'Impossible de supprimer: assignations actives' })
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('force') force?: string
    ) {
        console.log('🚛 DELETE /chauffeurs/:id - Suppression chauffeur:', id);
        console.log('🔥 Force delete:', force === 'true');

        const forceDelete = force === 'true';
        return this.chauffeursService.remove(id, forceDelete);
    }

    @Patch(':id/profile')
    @UseGuards(JwtAuthGuard)
    async updateProfile(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateData: {
            nom?: string;
            prenom?: string;
            email?: string;
            telephone?: string;
        },
        @Request() req
    ) {
        if (req.user.chauffeurId !== id && req.user.role !== 'ADMIN') {
            throw new UnauthorizedException('Accès non autorisé à ce profil');
        }

        return this.chauffeursService.updateProfile(id, updateData);
    }

    @Patch(':id/password')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Mettre à jour le mot de passe d\'un chauffeur' })
    @ApiResponse({ status: 200, description: 'Mot de passe mis à jour avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    async updatePassword(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updatePasswordDto: UpdateChauffeurPasswordDto
    ) {
        return this.chauffeursService.updatePassword(id, updatePasswordDto);
    }

    @Post(':id/generate-password')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Générer un nouveau mot de passe pour un chauffeur' })
    @ApiResponse({ status: 200, description: 'Nouveau mot de passe généré avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    async generatePassword(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() options?: GeneratePasswordDto
    ) {
        return this.chauffeursService.generateNewPassword(id, options);
    }

    @Post(':id/sync-profile')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Synchroniser le profil utilisateur avec les données chauffeur' })
    @ApiResponse({ status: 200, description: 'Profil utilisateur synchronisé avec succès' })
    @ApiResponse({ status: 404, description: 'Chauffeur non trouvé' })
    async syncUserProfile(
        @Param('id', ParseUUIDPipe) id: string
    ) {
        return this.chauffeursService.syncUserProfile(id);
    }
}