import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsArray } from 'class-validator';

export class CreateMagasinDto {
    @ApiProperty({ description: 'Nom du magasin' })
    @IsString()
    nom: string;

    @ApiProperty({ description: 'Adresse complète' })
    @IsString()
    adresse: string;

    @ApiProperty({ description: 'Numéro de téléphone', required: false })
    @IsOptional()
    @IsString()
    telephone?: string;

    @ApiProperty({ description: 'Email de contact', required: false })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({ description: 'Nom du manager', required: false })
    @IsOptional()
    @IsString()
    manager?: string;

    @ApiProperty({ description: 'Statut du magasin', required: false })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ description: 'Catégories supportées', required: false })
    @IsOptional()
    @IsArray()
    categories?: string[];
}