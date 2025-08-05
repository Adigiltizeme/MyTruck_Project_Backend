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
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';

import { CommandesService } from './commandes.service';
import { CreateCommandeDto, UpdateCommandeDto, CommandeFiltersDto, AssignChauffeursDto } from './dto';
import { UpdateStatutsDto } from './dto/statuts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@ApiTags('Commandes')
@Controller('commandes')
@UseGuards(JwtAuthGuard)
export class CommandesController {
    constructor(
        private readonly commandesService: CommandesService,
        private readonly prisma: PrismaService
    ) { }

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
    @Post()
    async create(@Body() createCommandeDto: any) { // ✅ Laisser en 'any' pour debug
        console.log('📝 ===== CRÉATION COMMANDE DEBUG =====');
        console.log('📝 clientNom reçu:', createCommandeDto.clientNom);
        console.log('📝 clientPrenom reçu:', createCommandeDto.clientPrenom);
        console.log('📝 magasinId reçu:', createCommandeDto.magasinId);
        console.log('📝 Structure complète:', Object.keys(createCommandeDto));

        // ✅ VALIDATION: Vérifier que le magasin existe
        const magasin = await this.prisma.magasin.findUnique({
            where: { id: createCommandeDto.magasinId }
        });

        if (!magasin) {
            console.error('❌ Magasin non trouvé:', createCommandeDto.magasinId);
            throw new BadRequestException(`Magasin ${createCommandeDto.magasinId} non trouvé`);
        }

        console.log('✅ Magasin trouvé:', magasin.nom);

        try {
            const result = await this.commandesService.create(createCommandeDto);
            console.log('✅ Commande créée avec succès:', result.id);
            return result;
        } catch (error) {
            console.error('❌ Erreur service:', error);
            throw error;
        }
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
        console.log('🔍 ===== PATCH /commandes/:id REÇU =====');
        console.log('🔍 ID commande:', id);
        console.log('🔍 Body complet:', JSON.stringify(updateCommandeDto, null, 2));

        // ✅ VÉRIFICATION : Le champ chauffeurIds est-il présent ?
        if (updateCommandeDto.chauffeurIds) {
            console.log('🚛 → CHAUFFEURS DÉTECTÉS:', updateCommandeDto.chauffeurIds);
        } else {
            console.log('❌ → Aucun chauffeurIds trouvé dans le body');
            console.log('❌ → Champs présents:', Object.keys(updateCommandeDto));
        }

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

    @Patch(':id/photos')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({
        summary: 'Mettre à jour les photos d\'une commande',
        description: 'Ajoute ou met à jour les photos d\'une commande'
    })
    async updatePhotos(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() photosData: { photos: Array<{ url: string; filename?: string }> }
    ) {
        console.log('📸 PATCH /photos reçu pour commande:', id);
        console.log('📸 Nombre de photos:', photosData.photos?.length || 0);
        return this.commandesService.updatePhotos(id, photosData.photos || []);
    }

    @Patch(':id/assign-chauffeurs')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Assigner des chauffeurs à une commande',
        description: 'Endpoint dédié pour l\'assignation de chauffeurs avec gestion des statuts'
    })
    async assignChauffeurs(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() assignData: AssignChauffeursDto
    ) {
        console.log('🚛 ===== ENDPOINT DÉDIÉ ASSIGNATION =====');
        console.log('🚛 Commande ID:', id);
        console.log('🚛 Assignation data:', assignData.chauffeurIds);
        console.log('🚛 Mode remplacement:', assignData.replaceAll);

        return this.commandesService.assignChauffeursWithStatus(
            id,
            assignData.chauffeurIds,
            {
                statutCommande: assignData.statutCommande,
                statutLivraison: assignData.statutLivraison,
                replaceAll: assignData.replaceAll,
            }
        );
    }

    @Patch(':id/statuts')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN, UserRole.CHAUFFEUR)
    @ApiOperation({
        summary: 'Mettre à jour les statuts d\'une commande',
        description: 'Endpoint intelligent avec règles métier automatiques'
    })
    @ApiResponse({
        status: 200,
        description: 'Statuts mis à jour avec succès',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                statutCommande: { type: 'string' },
                statutLivraison: { type: 'string' },
                autoActions: { type: 'array', items: { type: 'string' } },
                notifications: { type: 'array', items: { type: 'string' } }
            }
        }
    })
    @ApiResponse({ status: 400, description: 'Transition de statut invalide' })
    @ApiResponse({ status: 403, description: 'Permissions insuffisantes' })
    async updateStatuts(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateStatutsDto: UpdateStatutsDto,
        @CurrentUser() user: any
    ) {
        console.log('📊 ===== ENDPOINT STATUTS INTELLIGENT =====');
        console.log('📊 Commande ID:', id);
        console.log('📊 Statuts data:', updateStatutsDto);
        console.log('📊 Utilisateur:', user?.id, user?.role);

        // ✅ VALIDATION PERMISSIONS PAR RÔLE
        this.validateStatusPermissions(user.role, updateStatutsDto);

        return this.commandesService.updateStatutsWithBusinessRules(
            id,
            updateStatutsDto,
            user?.id
        );
    }

    /**
     * Validation des permissions par rôle
     */
    private validateStatusPermissions(userRole: string, updateData: UpdateStatutsDto) {
        // ✅ RÈGLE MÉTIER : Permissions par rôle
        if (userRole === 'MAGASIN') {
            // Magasin peut seulement modifier statut commande
            if (updateData.statutLivraison) {
                throw new ForbiddenException('Magasin ne peut pas modifier le statut de livraison');
            }
        } else if (userRole === 'CHAUFFEUR') {
            // Chauffeur peut seulement modifier statut livraison
            if (updateData.statutCommande) {
                throw new ForbiddenException('Chauffeur ne peut pas modifier le statut de commande');
            }
        }
        // Admin/Direction peuvent tout modifier
    }
}