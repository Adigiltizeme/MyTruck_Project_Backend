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
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';

import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, ClientFiltersDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Clients')
@Controller('clients')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ClientsController {
    constructor(private readonly clientsService: ClientsService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({
        summary: 'Créer un client',
        description: 'Crée un nouveau client'
    })
    @ApiResponse({ status: 201, description: 'Client créé avec succès' })
    @ApiResponse({ status: 403, description: 'Accès interdit' })
    async create(@Body() createClientDto: CreateClientDto) {
        return this.clientsService.create(createClientDto);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    async findAll(@Query() filters: ClientFiltersDto, @Request() req: any) {
        // LOGS DE DÉBOGAGE
        console.log('🔑 Headers authorization:', req.headers.authorization);
        console.log('👤 req.user:', req.user);
        console.log('🎭 Role détecté:', req.user?.role);

        return this.clientsService.findAll(filters, req.user?.role, req.user?.magasinId);
    }

    @Get('search')
    @ApiOperation({
        summary: 'Rechercher des clients',
        description: 'Recherche des clients par nom, prénom, téléphone ou ville'
    })
    @ApiQuery({
        name: 'q',
        type: 'string',
        description: 'Terme de recherche',
        required: true
    })
    @ApiResponse({ status: 200, description: 'Résultats de recherche' })
    async search(@Query('q') searchTerm: string) {
        if (!searchTerm || searchTerm.trim().length < 2) {
            return { data: [], message: 'Le terme de recherche doit contenir au moins 2 caractères' };
        }

        const results = await this.clientsService.searchClients(searchTerm.trim());
        return { data: results };
    }

    @Get('by-phone/:telephone')
    @ApiOperation({
        summary: 'Rechercher par téléphone',
        description: 'Recherche des clients par numéro de téléphone'
    })
    @ApiResponse({ status: 200, description: 'Clients trouvés' })
    async findByPhone(@Param('telephone') telephone: string) {
        return this.clientsService.findByPhone(telephone);
    }

    @Get(':id')
    @ApiOperation({
        summary: 'Détails d\'un client',
        description: 'Récupère les détails d\'un client avec ses commandes récentes'
    })
    @ApiResponse({
        status: 200,
        description: 'Client trouvé',
        schema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                nom: { type: 'string' },
                prenom: { type: 'string' },
                telephone: { type: 'string' },
                adresseLigne1: { type: 'string' },
                ville: { type: 'string' },
                typeAdresse: { type: 'string' },
                commandes: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            numeroCommande: { type: 'string' },
                            dateCommande: { type: 'string' },
                            statutCommande: { type: 'string' },
                            statutLivraison: { type: 'string' }
                        }
                    }
                },
                _count: {
                    type: 'object',
                    properties: {
                        commandes: { type: 'number' }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 404, description: 'Client non trouvé' })
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.clientsService.findOne(id);
    }

    @Get(':id/stats')
    @ApiOperation({
        summary: 'Statistiques d\'un client',
        description: 'Récupère les statistiques détaillées d\'un client'
    })
    @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
    @ApiResponse({ status: 404, description: 'Client non trouvé' })
    async getStats(@Param('id', ParseUUIDPipe) id: string) {
        return this.clientsService.getClientStats(id);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
    @ApiOperation({
        summary: 'Modifier un client',
        description: 'Met à jour les informations d\'un client'
    })
    @ApiResponse({ status: 200, description: 'Client mis à jour avec succès' })
    @ApiResponse({ status: 404, description: 'Client non trouvé' })
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateClientDto: UpdateClientDto
    ) {
        return this.clientsService.update(id, updateClientDto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({
        summary: 'Supprimer un client',
        description: 'Supprime un client (Admin/Direction uniquement)'
    })
    @ApiResponse({ status: 200, description: 'Client supprimé avec succès' })
    @ApiResponse({ status: 404, description: 'Client non trouvé' })
    @ApiResponse({ status: 400, description: 'Impossible de supprimer: commandes associées' })
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.clientsService.remove(id);
    }
}