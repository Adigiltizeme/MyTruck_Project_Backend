import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('Santé du système')
@Controller('health')
export class HealthController {
    constructor(private readonly healthService: HealthService) { }

    @Get()
    @ApiOperation({
        summary: 'Vérification de santé',
        description: 'Vérifie l\'état de l\'API et de ses dépendances'
    })
    @ApiResponse({ status: 200, description: 'État de santé du système' })
    async health() {
        return this.healthService.checkHealth();
    }

    @Get('version')
    @ApiOperation({
        summary: 'Version de l\'API',
        description: 'Retourne les informations de version'
    })
    @ApiResponse({ status: 200, description: 'Informations de version' })
    async version() {
        return this.healthService.getVersion();
    }
}
