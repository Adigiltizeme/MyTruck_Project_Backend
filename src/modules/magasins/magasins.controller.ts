import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
    ParseUUIDPipe,
    Request,
    UnauthorizedException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { MagasinsService } from './magasins.service';
import { CreateMagasinDto, UpdateMagasinDto, UpdateMagasinPasswordDto, GenerateMagasinPasswordDto } from './dto';

@ApiTags('Magasins')
@Controller('magasins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MagasinsController {
    constructor(private readonly magasinsService: MagasinsService) { }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({
        summary: 'Lister tous les magasins',
        description: 'Récupère la liste de tous les magasins avec filtres'
    })
    @ApiResponse({ status: 200, description: 'Liste des magasins récupérée avec succès' })
    async findAll(
        @Query('skip') skip?: string,
        @Query('take') take?: string,
        @Query('status') status?: string
    ) {
        console.log('🏪 GET /magasins appelé');

        // Même structure que chauffeurs.controller.ts
        const filters = {
            skip: skip ? parseInt(skip) : undefined,
            take: take ? parseInt(take) : undefined,
            status
        };

        const result = await this.magasinsService.findAll(filters);

        console.log(`✅ ${result.length} magasins récupérés`);

        // Format identique aux chauffeurs
        return {
            data: result,
            meta: {
                total: result.length,
                skip: filters.skip || 0,
                take: filters.take || 50,
                hasMore: false
            }
        };
    }

    @Get(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({ summary: 'Détails d\'un magasin' })
    @ApiResponse({ status: 200, description: 'Magasin trouvé' })
    @ApiResponse({ status: 404, description: 'Magasin non trouvé' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        console.log('🏪 GET /magasins/:id appelé pour:', id);
        return this.magasinsService.findOne(id);
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Créer un nouveau magasin' })
    @ApiResponse({ status: 201, description: 'Magasin créé avec succès' })
    @ApiResponse({ status: 400, description: 'Données invalides' })
    async create(@Body() createMagasinDto: CreateMagasinDto) {
        console.log('🏪 POST /magasins - Création magasin:', createMagasinDto.nom);
        return this.magasinsService.create(createMagasinDto);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Modifier un magasin' })
    @ApiResponse({ status: 200, description: 'Magasin mis à jour avec succès' })
    @ApiResponse({ status: 404, description: 'Magasin non trouvé' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateMagasinDto: UpdateMagasinDto
    ) {
        console.log('🏪 PATCH /magasins/:id - Modification magasin:', id);
        console.log('📝 Données reçues:', updateMagasinDto);
        return this.magasinsService.update(id, updateMagasinDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Supprimer un magasin' })
    @ApiResponse({ status: 200, description: 'Magasin supprimé avec succès' })
    @ApiResponse({ status: 404, description: 'Magasin non trouvé' })
    @ApiResponse({ status: 400, description: 'Impossible de supprimer: données liées existantes' })
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('force') force?: string
    ) {
        console.log('🏪 DELETE /magasins/:id - Suppression magasin:', id);
        console.log('🔥 Force delete:', force === 'true');

        const forceDelete = force === 'true';
        return this.magasinsService.remove(id, forceDelete);
    }

    @Get(':id/dependencies')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Voir les dépendances d\'un magasin',
        description: 'Affiche la liste détaillée des éléments liés à un magasin avant suppression'
    })
    @ApiResponse({ status: 200, description: 'Dépendances récupérées avec succès' })
    @ApiResponse({ status: 404, description: 'Magasin non trouvé' })
    async getDependencies(@Param('id', ParseUUIDPipe) id: string) {
        console.log('🔍 GET /magasins/:id/dependencies pour:', id);
        return this.magasinsService.getDependencies(id);
    }

    @Get(':id/stats')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({ summary: 'Statistiques d\'un magasin' })
    @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
    async getStats(@Param('id', ParseUUIDPipe) id: string) {
        console.log('📊 GET /magasins/:id/stats pour:', id);
        return this.magasinsService.getStats(id);
    }

    @Post(':id/account')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    async createOrUpdateAccount(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() accountDto: {
            email: string;
            password?: string;
            generatePassword: boolean;
        }
    ) {
        return this.magasinsService.createOrUpdateAccount(id, accountDto);
    }

    @Patch(':id/profile')
    @UseGuards(JwtAuthGuard)
    async updateProfile(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateData: {
            nom?: string;
            email?: string;
            telephone?: string;
        },
        @Request() req: any
    ) {
        // Vérifier que l'utilisateur modifie bien son propre profil
        if (req.user.magasinId !== id && req.user.role !== 'ADMIN') {
            throw new UnauthorizedException('Accès non autorisé à ce profil');
        }

        return this.magasinsService.updateProfile(id, updateData);
    }

    @Patch(':id/password')
    @UseGuards(JwtAuthGuard)
    async changePassword(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() passwordData: {
            currentPassword: string;
            newPassword: string;
        },
        @Request() req
    ) {
        if (req.user.magasinId !== id && req.user.role !== 'ADMIN') {
            throw new UnauthorizedException('Accès non autorisé');
        }

        return this.magasinsService.changePassword(id, passwordData);
    }

    @Patch(':id/password/admin')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Mettre à jour le mot de passe d\'un magasin (admin)' })
    @ApiResponse({ status: 200, description: 'Mot de passe mis à jour avec succès' })
    async updatePassword(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updatePasswordDto: UpdateMagasinPasswordDto
    ) {
        return this.magasinsService.updatePassword(id, updatePasswordDto);
    }

    @Post(':id/password/generate')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Générer un nouveau mot de passe pour un magasin' })
    @ApiResponse({ status: 200, description: 'Nouveau mot de passe généré avec succès' })
    async generateNewPassword(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() options?: GenerateMagasinPasswordDto
    ) {
        return this.magasinsService.generateNewPassword(id, options);
    }

    @Post(':id/sync-profile')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Synchroniser le profil utilisateur d\'un magasin' })
    @ApiResponse({ status: 200, description: 'Profil synchronisé avec succès' })
    async syncUserProfile(@Param('id', ParseUUIDPipe) id: string) {
        return this.magasinsService.syncUserProfile(id);
    }
}