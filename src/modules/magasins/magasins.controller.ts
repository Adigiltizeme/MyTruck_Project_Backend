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

import { MagasinsService } from './magasins.service';
import { CreateMagasinDto, UpdateMagasinDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/types/user.types';

@ApiTags('Magasins')
@Controller('magasins')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MagasinsController {
    constructor(private readonly magasinsService: MagasinsService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Créer un magasin',
        description: 'Crée un nouveau magasin (Admin/Direction uniquement)'
    })
    @ApiResponse({ status: 201, description: 'Magasin créé avec succès' })
    @ApiResponse({ status: 403, description: 'Accès interdit' })
    async create(@Body() createMagasinDto: CreateMagasinDto) {
        return this.magasinsService.create(createMagasinDto);
    }

    @Get()
    @ApiOperation({
        summary: 'Lister les magasins',
        description: 'Récupère la liste des magasins avec pagination'
    })
    @ApiQuery({ name: 'skip', type: 'number', required: false, description: 'Nombre d\'éléments à ignorer' })
    @ApiQuery({ name: 'take', type: 'number', required: false, description: 'Nombre d\'éléments à récupérer' })
    @ApiQuery({ name: 'status', type: 'string', required: false, description: 'Filtrer par statut' })
    @ApiResponse({ status: 200, description: 'Liste des magasins récupérée avec succès' })
    async findAll(
        @Query('skip') skip?: string,
        @Query('take') take?: string,
        @Query('status') status?: string,
    ) {
        const where: any = {};

        if (status) where.status = status;

        return this.magasinsService.findAll({
            skip: skip ? parseInt(skip, 10) : undefined,
            take: take ? parseInt(take, 10) : undefined,
            where,
        });
    }

    @Get('by-status/:status')
    @ApiOperation({
        summary: 'Magasins par statut',
        description: 'Récupère les magasins d\'un statut spécifique'
    })
    @ApiResponse({ status: 200, description: 'Magasins récupérés avec succès' })
    async findByStatus(@Param('status') status: string) {
        return this.magasinsService.findByStatus(status);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Détails d\'un magasin',
        description: 'Récupère les détails d\'un magasin par son ID'
    })
    @ApiResponse({ status: 200, description: 'Magasin trouvé' })
    @ApiResponse({ status: 404, description: 'Magasin non trouvé' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.magasinsService.findOne(id);
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: 'Statistiques d\'un magasin',
        description: 'Récupère les statistiques détaillées d\'un magasin'
    })
    @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
    @ApiResponse({ status: 404, description: 'Magasin non trouvé' })
    async getStats(@Param('id', ParseUUIDPipe) id: string) {
        return this.magasinsService.getStats(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Modifier un magasin',
        description: 'Met à jour les informations d\'un magasin'
    })
    @ApiResponse({ status: 200, description: 'Magasin mis à jour avec succès' })
    @ApiResponse({ status: 404, description: 'Magasin non trouvé' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateMagasinDto: UpdateMagasinDto
    ) {
        return this.magasinsService.update(id, updateMagasinDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: 'Supprimer un magasin',
        description: 'Supprime un magasin (Admin uniquement)'
    })
    @ApiResponse({ status: 200, description: 'Magasin supprimé avec succès' })
    @ApiResponse({ status: 404, description: 'Magasin non trouvé' })
    @ApiResponse({ status: 400, description: 'Impossible de supprimer: données liées existantes' })
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.magasinsService.remove(id);
    }
}