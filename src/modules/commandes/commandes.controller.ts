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
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';

import { CommandesService } from './commandes.service';
import { CreateCommandeDto, UpdateCommandeDto, CommandeFiltersDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Commandes')
@Controller('commandes')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class CommandesController {
    constructor(private readonly commandesService: CommandesService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({
        summary: 'Créer une commande',
        description: 'Crée une nouvelle commande avec client et articles'
    })
    @ApiResponse({
        status: 201,
        description: 'Commande créée avec succès',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                numeroCommande: { type: 'string' },
                statutCommande: { type: 'string' },
                statutLivraison: { type: 'string' },
                dateLivraison: { type: 'string', format: 'date-time' },
                client: { type: 'object' },
                magasin: { type: 'object' },
                articles: { type: 'array' },
                chauffeurs: { type: 'array' }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    @ApiResponse({ status: 403, description: 'Accès interdit' })
    async create(@Body() createCommandeDto: CreateCommandeDto) {
        return this.commandesService.create(createCommandeDto);
    }

    @Get()
    @ApiOperation({
        summary: 'Lister les commandes',
        description: 'Récupère la liste des commandes avec filtres et pagination'
    })
    @ApiResponse({
        status: 200,
        description: 'Liste des commandes récupérée avec succès',
        schema: {
            type: 'object',
            properties: {
                data: {
                    type: 'array',
                    items: { type: 'object' }
                },
                meta: {
                    type: 'object',
                    properties: {
                        total: { type: 'number' },
                        skip: { type: 'number' },
                        take: { type: 'number' },
                        hasMore: { type: 'boolean' }
                    }
                }
            }
        }
    })
    async findAll(@Query() filters: CommandeFiltersDto, @CurrentUser() user: any) {
        // Si l'utilisateur est un magasin, filtrer par son magasin uniquement
        if (user.role === UserRole.MAGASIN && user.magasinId && !filters.magasinId) {
            filters.magasinId = user.magasinId;
        }

        return this.commandesService.findAll(filters);
    }

    @Get('stats')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({
        summary: 'Statistiques des commandes',
        description: 'Récupère les statistiques globales des commandes'
    })
    @ApiQuery({
        name: 'magasinId',
        type: 'string',
        required: false,
        description: 'Filtrer par magasin (optionnel)'
    })
    @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
    async getStats(@Query('magasinId') magasinId?: string, @CurrentUser() user?: any) {
        // Si l'utilisateur est un magasin, limiter aux stats de son magasin
        const effectiveMagasinId = user?.role === UserRole.MAGASIN ? user.magasinId : magasinId;

        return this.commandesService.getStats(effectiveMagasinId);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Détails d\'une commande',
        description: 'Récupère les détails complets d\'une commande par son ID'
    })
    @ApiResponse({
        status: 200,
        description: 'Commande trouvée',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                numeroCommande: { type: 'string' },
                dateCommande: { type: 'string', format: 'date-time' },
                dateLivraison: { type: 'string', format: 'date-time' },
                statutCommande: { type: 'string' },
                statutLivraison: { type: 'string' },
                client: {
                    type: 'object',
                    properties: {
                        nom: { type: 'string' },
                        prenom: { type: 'string' },
                        telephone: { type: 'string' },
                        adresseLigne1: { type: 'string' }
                    }
                },
                magasin: { type: 'object' },
                chauffeurs: { type: 'array' },
                articles: { type: 'array' },
                photos: { type: 'array' },
                commentaires: { type: 'array' },
                rapportsEnlevement: { type: 'array' },
                rapportsLivraison: { type: 'array' },
                factures: { type: 'array' },
                devis: { type: 'array' }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Commande non trouvée' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.commandesService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN, UserRole.CHAUFFEUR)
    @ApiOperation({
        summary: 'Modifier une commande',
        description: 'Met à jour les informations d\'une commande'
    })
    @ApiResponse({ status: 200, description: 'Commande mise à jour avec succès' })
    @ApiResponse({ status: 404, description: 'Commande non trouvée' })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateCommandeDto: UpdateCommandeDto
    ) {
        return this.commandesService.update(id, updateCommandeDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Supprimer une commande',
        description: 'Supprime une commande (Admin/Direction uniquement)'
    })
    @ApiResponse({ status: 200, description: 'Commande supprimée avec succès' })
    @ApiResponse({ status: 404, description: 'Commande non trouvée' })
    @ApiResponse({ status: 400, description: 'Impossible de supprimer: données liées existantes' })
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.commandesService.remove(id);
    }

    @Get('magasin/:magasinId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({
        summary: 'Commandes par magasin',
        description: 'Récupère les commandes d\'un magasin spécifique'
    })
    @ApiResponse({ status: 200, description: 'Commandes récupérées avec succès' })
    async findByMagasin(
        @Param('magasinId', ParseUUIDPipe) magasinId: string,
        @Query() filters: CommandeFiltersDto
    ) {
        filters.magasinId = magasinId;
        return this.commandesService.findAll(filters);
    }

    @Get('chauffeur/:chauffeurId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHAUFFEUR)
    @ApiOperation({
        summary: 'Commandes par chauffeur',
        description: 'Récupère les commandes assignées à un chauffeur'
    })
    @ApiResponse({ status: 200, description: 'Commandes récupérées avec succès' })
    async findByChauffeur(
        @Param('chauffeurId', ParseUUIDPipe) chauffeurId: string,
        @Query() filters: CommandeFiltersDto
    ) {
        filters.chauffeurId = chauffeurId;
        return this.commandesService.findAll(filters);
    }

    @Patch(':id/statut-commande')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Changer le statut de commande',
        description: 'Met à jour uniquement le statut de la commande'
    })
    @ApiResponse({ status: 200, description: 'Statut mis à jour avec succès' })
    async updateStatutCommande(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('statut') statut: string
    ) {
        return this.commandesService.update(id, { statutCommande: statut as any });
    }

    @Patch(':id/statut-livraison')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.CHAUFFEUR)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Changer le statut de livraison',
        description: 'Met à jour uniquement le statut de la livraison (Chauffeurs autorisés)'
    })
    @ApiResponse({ status: 200, description: 'Statut mis à jour avec succès' })
    async updateStatutLivraison(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('statut') statut: string
    ) {
        return this.commandesService.update(id, { statutLivraison: statut as any });
    }
}