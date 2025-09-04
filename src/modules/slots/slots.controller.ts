import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SlotsService } from './slots.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('slots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('slots')
export class SlotsController {
    constructor(private readonly slotsService: SlotsService) { }

    // 📋 RÉCUPÉRER TOUS LES CRÉNEAUX
    @Get()
    @ApiOperation({ summary: 'Récupérer tous les créneaux' })
    @ApiResponse({ status: 200, description: 'Liste des créneaux récupérée' })
    findAll() {
        console.log('📋 GET /slots - Récupération tous les créneaux');
        return this.slotsService.findAll();
    }

    // 📅 DISPONIBILITÉ POUR UNE DATE
    @Get('availability/:date')
    @ApiOperation({ summary: 'Vérifier la disponibilité des créneaux pour une date' })
    @ApiResponse({ status: 200, description: 'Disponibilité calculée' })
    getAvailability(@Param('date') date: string) {
        console.log('📅 GET /slots/availability/:date - Date:', date);
        return this.slotsService.getAvailabilityForDate(date);
    }

    // 🆕 CRÉER UN CRÉNEAU (ADMIN SEULEMENT)
    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Créer un nouveau créneau' })
    @ApiResponse({ status: 201, description: 'Créneau créé avec succès' })
    create(@Body() createTimeSlotDto: any) {
        console.log('🆕 POST /slots - Création créneau:', createTimeSlotDto);
        return this.slotsService.create(createTimeSlotDto);
    }

    // 🔄 METTRE À JOUR UN CRÉNEAU (ADMIN SEULEMENT)
    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Mettre à jour un créneau' })
    @ApiResponse({ status: 200, description: 'Créneau mis à jour avec succès' })
    async update(
        @Param('id') id: string,  // 🔧 SANS ParseUUIDPipe
        @Body() updateTimeSlotDto: any
    ) {
        console.log('🔄 PATCH /slots/:id - Mise à jour créneau:', { id, updates: updateTimeSlotDto });

        try {
            const result = await this.slotsService.update(id, updateTimeSlotDto);
            console.log('✅ Créneau mis à jour avec succès');
            return result;
        } catch (error) {
            console.error('❌ Erreur mise à jour créneau:', error);
            throw error;
        }
    }

    // 🗑️ SUPPRIMER UN CRÉNEAU (ADMIN SEULEMENT)
    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Supprimer un créneau' })
    @ApiResponse({ status: 200, description: 'Créneau supprimé avec succès' })
    async remove(@Param('id') id: string) {  // 🔧 SANS ParseUUIDPipe
        console.log('🗑️ DELETE /slots/:id - Suppression créneau:', id);

        try {
            const result = await this.slotsService.remove(id);
            console.log('✅ Créneau supprimé avec succès');
            return result;
        } catch (error) {
            console.error('❌ Erreur suppression créneau:', error);
            throw error;
        }
    }

    // 📊 RÉCUPÉRER LES RESTRICTIONS
    @Get('restrictions')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Récupérer les restrictions actives' })
    @ApiResponse({ status: 200, description: 'Restrictions récupérées' })
    getRestrictions(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string
    ) {
        console.log('📊 GET /slots/restrictions - Paramètres:', { startDate, endDate });
        return this.slotsService.getActiveRestrictions(startDate, endDate);
    }

    // 🚫 BLOQUER UN CRÉNEAU (ADMIN SEULEMENT)
    @Post('restrictions')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Bloquer un créneau pour une date' })
    @ApiResponse({ status: 201, description: 'Créneau bloqué avec succès' })
    async createRestriction(
        @Body() createRestrictionDto: any,
        @Request() req: any
    ) {
        console.log('🚫 POST /slots/restrictions - Blocage:', createRestrictionDto);
        console.log('👤 Utilisateur:', req.user?.sub || req.user?.id);

        const userId = req.user?.sub || req.user?.id;

        if (!userId) {
            throw new Error('ID utilisateur non trouvé');
        }

        try {
            const result = await this.slotsService.createRestriction(createRestrictionDto, userId);
            console.log('✅ Restriction créée avec succès');
            return result;
        } catch (error) {
            console.error('❌ Erreur création restriction:', error);
            throw error;
        }
    }

    // ✅ DÉBLOQUER UN CRÉNEAU (ADMIN SEULEMENT)
    @Delete('restrictions/:date/:slotId')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Débloquer un créneau pour une date' })
    @ApiResponse({ status: 200, description: 'Créneau débloqué avec succès' })
    async removeRestriction(
        @Param('date') date: string,
        @Param('slotId') slotId: string  // 🔧 SANS ParseUUIDPipe
    ) {
        console.log('✅ DELETE /slots/restrictions/:date/:slotId - Déblocage:', { date, slotId });

        try {
            const result = await this.slotsService.removeRestriction(date, slotId);
            console.log('✅ Restriction supprimée avec succès');
            return result;
        } catch (error) {
            console.error('❌ Erreur suppression restriction:', error);
            throw error;
        }
    }

    // 🧹 NETTOYER LES RESTRICTIONS EXPIRÉES (CRON/ADMIN)
    @Post('restrictions/cleanup')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.DIRECTION)
    @ApiOperation({ summary: 'Nettoyer les restrictions expirées' })
    @ApiResponse({ status: 200, description: 'Nettoyage effectué' })
    async cleanupExpiredRestrictions() {
        console.log('🧹 POST /slots/restrictions/cleanup - Nettoyage');

        try {
            const result = await this.slotsService.cleanupExpiredRestrictions();
            console.log('✅ Nettoyage terminé');
            return result;
        } catch (error) {
            console.error('❌ Erreur nettoyage:', error);
            throw error;
        }
    }
}