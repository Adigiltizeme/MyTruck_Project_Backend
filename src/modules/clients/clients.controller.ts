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
        // 🔧 LOGS DE DÉBOGAGE AMÉLIORÉS
        console.log('🔑 Headers authorization:', req.headers.authorization ? 'Present' : 'Missing');
        console.log('👤 req.user complet:', JSON.stringify(req.user, null, 2));

        // 🔧 EXTRACTION ROBUSTE DU MAGASIN ID
        let magasinId: string | null = null;
        let userRole: string = 'MAGASIN'; // Par défaut

        if (req.user) {
            // Normaliser le rôle
            userRole = req.user.role?.toUpperCase() || 'MAGASIN';
            console.log('🎭 Rôle normalisé:', userRole);

            // 🔧 EXTRACTION MAGASIN ID - MULTIPLE SOURCES
            if (userRole === 'MAGASIN') {
                // Essayer toutes les sources possibles
                magasinId = req.user.magasinId ||           // Direct magasinId
                    req.user.magasin?.id ||           // Objet magasin nested
                    req.user.storeId ||               // Legacy storeId
                    req.user.store?.id ||             // Legacy store nested
                    null;

                console.log('🏪 Sources magasinId testées:', {
                    'req.user.magasinId': req.user.magasinId,
                    'req.user.magasin?.id': req.user.magasin?.id,
                    'req.user.storeId': req.user.storeId,
                    'req.user.store?.id': req.user.store?.id,
                    'RÉSULTAT': magasinId
                });

                if (!magasinId) {
                    console.error('❌ ERREUR CRITIQUE: Utilisateur magasin sans magasinId');
                    console.error('👤 Objet user complet:', req.user);

                    // 🔧 SOLUTION TEMPORAIRE: Chercher par email
                    if (req.user.email?.includes('truffaut.com')) {
                        // Mapping temporaire basé sur l'email
                        if (req.user.email.includes('boulogne')) {
                            magasinId = '76997d1d-2cc9-4144-96b9-4f3b181af0fc'; // Truffaut Boulogne
                        } else if (req.user.email.includes('ivry')) {
                            magasinId = '03705e9e-9af9-41ca-8e28-5046455b4b6f'; // Truffaut Ivry
                        } else {
                            // Par défaut, utiliser Truffaut Boulogne pour r.bessaraoui@truffaut.com
                            magasinId = '76997d1d-2cc9-4144-96b9-4f3b181af0fc';
                        }
                        console.log('🔧 MAPPING TEMPORAIRE APPLIQUÉ:', magasinId);
                    }
                }
            }
        }

        console.log('🏪 MagasinId FINAL utilisé:', magasinId);
        console.log('🎭 UserRole FINAL:', userRole);

        // 🔧 VALIDATION AVANT APPEL SERVICE
        if (userRole === 'MAGASIN' && !magasinId) {
            console.error('❌ ÉCHEC: Impossible de déterminer le magasinId');
            return {
                data: [],
                meta: {
                    total: 0,
                    skip: 0,
                    take: 50,
                    hasMore: false,
                    error: 'Magasin non identifié pour cet utilisateur'
                }
            };
        }

        try {
            const result = await this.clientsService.findAll(filters, userRole, magasinId);

            console.log('✅ Service findAll résultat:', {
                clientsCount: result.data?.length || 0,
                total: result.meta?.total || 0,
                userRole,
                magasinId
            });

            return result;
        } catch (error) {
            console.error('❌ Erreur dans findAll:', error);
            throw error;
        }
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