import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumberString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MagasinFiltersDto {
    @ApiProperty({
        description: 'Nombre d\'éléments à ignorer pour la pagination',
        required: false,
        type: Number,
        minimum: 0,
        default: 0
    })
    @IsOptional()
    @Type(() => Number)
    @Min(0)
    skip?: number;

    @ApiProperty({
        description: 'Nombre d\'éléments à retourner',
        required: false,
        type: Number,
        minimum: 1,
        maximum: 100,
        default: 50
    })
    @IsOptional()
    @Type(() => Number)
    @Min(1)
    @Max(100)
    take?: number;

    @ApiProperty({
        description: 'Filtrer par statut',
        enum: ['actif', 'inactif'],
        required: false
    })
    @IsOptional()
    @IsEnum(['actif', 'inactif'])
    status?: 'actif' | 'inactif';

    @ApiProperty({
        description: 'Terme de recherche (nom, adresse, manager)',
        required: false,
        minLength: 2,
        maxLength: 100
    })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({
        description: 'Trier par champ',
        required: false,
        enum: ['nom', 'adresse', 'status', 'createdAt', 'updatedAt'],
        default: 'nom'
    })
    @IsOptional()
    @IsString()
    sortBy?: 'nom' | 'adresse' | 'status' | 'createdAt' | 'updatedAt';

    @ApiProperty({
        description: 'Ordre de tri',
        required: false,
        enum: ['asc', 'desc'],
        default: 'asc'
    })
    @IsOptional()
    @IsString()
    sortOrder?: 'asc' | 'desc';
}