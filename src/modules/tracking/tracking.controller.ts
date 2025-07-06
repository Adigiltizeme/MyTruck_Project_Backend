import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('tracking')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingController {
    constructor(private trackingService: TrackingService) { }

    @Post('event')
    @Roles(UserRole.CHAUFFEUR, UserRole.ADMIN, UserRole.MAGASIN)
    async createTrackingEvent(@Body() data: any) {
        return this.trackingService.createTrackingEvent(data);
    }

    @Get('commande/:id')
    @Roles(UserRole.ADMIN, UserRole.MAGASIN, UserRole.CHAUFFEUR)
    async getCommandeTracking(@Param('id') commandeId: string) {
        return this.trackingService.getCommandeTracking(commandeId);
    }

    @Post('position')
    @Roles(UserRole.CHAUFFEUR) // SEULS LES CHAUFFEURS
    async updatePosition(@Body() data: any) {
        return this.trackingService.updateChauffeurPosition(
            data.chauffeurId,
            data.latitude,
            data.longitude,
        );
    }

    @Post('status')
    @Roles(UserRole.ADMIN, UserRole.MAGASIN) // PAS LES CHAUFFEURS
    async updateStatus(@Body() data: any) {
        return this.trackingService.updateCommandeStatus(
            data.commandeId,
            data.newStatus,
            data.changedBy,
            data.reason
        );
    }
}