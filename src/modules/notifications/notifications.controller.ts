import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private notificationsService: NotificationsService) { }

    @Post('send')
    async sendNotification(@Body() data: any) {
        return this.notificationsService.createNotification(data);
    }

    @Post('status-change')
    async notifyStatusChange(@Body() data: any) {
        return this.notificationsService.notifyStatusChange(
            data.commandeId,
            data.oldStatus,
            data.newStatus,
        );
    }
}