import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Admin - Fix Data')
@Controller('admin/fix')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class FixClientDatesController {
    constructor(private readonly prisma: PrismaService) {}

    @Post('client-dates')
    @ApiOperation({
        summary: 'Fix client dataRetentionUntil dates',
        description: 'ADMIN ONLY: Fixes NULL dataRetentionUntil dates for clients'
    })
    async fixClientDates() {
        try {
            console.log('🔧 [API] Correction des dates de rétention clients...');
            
            // Date de rétention dans 2 ans
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 2);
            
            // Statistiques avant correction
            const [totalClients, validClients, nullClients] = await Promise.all([
                this.prisma.client.count(),
                this.prisma.client.count({ where: { dataRetentionUntil: { gte: new Date() } } }),
                this.prisma.client.count({ where: { dataRetentionUntil: null } })
            ]);
            
            console.log(`📊 État: ${totalClients} total, ${validClients} valides, ${nullClients} NULL`);
            
            if (nullClients === 0) {
                return {
                    success: true,
                    message: 'Tous les clients ont déjà des dates valides',
                    stats: { totalClients, validClients, nullClients, corrected: 0 }
                };
            }
            
            // Correction
            const result = await this.prisma.client.updateMany({
                where: {
                    OR: [
                        { dataRetentionUntil: null },
                        { dataRetentionUntil: { lt: new Date() } }
                    ]
                },
                data: {
                    dataRetentionUntil: futureDate
                }
            });
            
            console.log(`✅ ${result.count} clients corrigés`);
            
            // Vérification
            const validClientsAfter = await this.prisma.client.count({
                where: {
                    dataRetentionUntil: { gte: new Date() },
                    deletionRequested: false
                }
            });
            
            return {
                success: true,
                message: `${result.count} clients corrigés avec succès`,
                stats: {
                    totalClients,
                    validClientsBefore: validClients,
                    validClientsAfter,
                    nullClients,
                    corrected: result.count,
                    newRetentionDate: futureDate.toISOString()
                }
            };
            
        } catch (error) {
            console.error('❌ Erreur correction dates:', error);
            return {
                success: false,
                error: error.message,
                message: 'Erreur lors de la correction des dates'
            };
        }
    }
}