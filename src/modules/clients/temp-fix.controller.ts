import { Controller, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';

@ApiTags('Temp - Emergency Fix')
@Controller('emergency')
export class TempFixController {
    constructor(private readonly prisma: PrismaService) {}

    @Post('fix-client-dates-now')
    @ApiOperation({
        summary: 'EMERGENCY: Fix client dataRetentionUntil dates (NO AUTH)',
        description: 'Temporary endpoint to fix NULL dates - REMOVE AFTER USE'
    })
    async emergencyFixClientDates() {
        try {
            console.log('🚨 [EMERGENCY] Correction des dates de rétention clients...');
            
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 2);
            
            const [totalClients, nullClients] = await Promise.all([
                this.prisma.client.count(),
                this.prisma.client.count({ where: { dataRetentionUntil: null } })
            ]);
            
            console.log(`📊 ${totalClients} total, ${nullClients} NULL`);
            
            const result = await this.prisma.client.updateMany({
                where: {
                    OR: [
                        { dataRetentionUntil: null },
                        { dataRetentionUntil: { lt: new Date() } }
                    ]
                },
                data: { dataRetentionUntil: futureDate }
            });
            
            const validAfter = await this.prisma.client.count({
                where: { dataRetentionUntil: { gte: new Date() } }
            });
            
            console.log(`✅ ${result.count} clients corrigés`);
            
            return {
                success: true,
                message: `EMERGENCY FIX: ${result.count} clients corrigés`,
                stats: {
                    totalClients,
                    nullClients,
                    corrected: result.count,
                    validAfter,
                    newRetentionDate: futureDate.toISOString()
                }
            };
            
        } catch (error) {
            console.error('❌ Erreur emergency fix:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}