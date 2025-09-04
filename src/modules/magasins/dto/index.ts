export * from './create-magasin.dto';
export * from './update-magasin.dto';

import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class UpdateMagasinPasswordDto {
    @ApiProperty({
        example: 'nouveaumotdepasse123',
        description: 'Nouveau mot de passe pour le responsable du magasin'
    })
    @IsString()
    password: string;
}

export class GenerateMagasinPasswordDto {
    @ApiProperty({
        example: true,
        description: 'Générer un nouveau mot de passe automatiquement',
        required: false
    })
    @IsOptional()
    generateRandom?: boolean;
}