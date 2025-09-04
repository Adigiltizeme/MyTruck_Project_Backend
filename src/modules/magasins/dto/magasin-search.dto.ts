import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class MagasinSearchDto {
    @ApiProperty({
        description: 'Terme de recherche',
        example: 'Truffaut',
        minLength: 2,
        maxLength: 50
    })
    @IsString()
    @MinLength(2, { message: 'Le terme de recherche doit contenir au moins 2 caractères' })
    @MaxLength(50, { message: 'Le terme de recherche ne peut pas dépasser 50 caractères' })
    q: string;

    @ApiProperty({
        description: 'Nombre maximum de résultats',
        required: false,
        type: Number,
        minimum: 1,
        maximum: 20,
        default: 10
    })
    @IsOptional()
    @Type(() => Number)
    limit?: number;
}