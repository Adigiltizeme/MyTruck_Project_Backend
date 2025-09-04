import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEmail, IsArray } from 'class-validator';

export class CreateMagasinDto {
    @ApiProperty({
        example: 'Truffaut Boulogne',
        description: 'Nom du magasin'
    })
    @IsString()
    nom: string;

    @ApiProperty({
        example: '33 Av. Edouard Vaillant, 92100 Boulogne-Billancourt',
        description: 'Adresse complète'
    })
    @IsString()
    adresse: string;

    @ApiProperty({
        example: '01 23 45 67 89',
        description: 'Numéro de téléphone',
        required: false
    })
    @IsOptional()
    @IsString()
    telephone?: string;

    @ApiProperty({
        example: 'boulogne@truffaut.com',
        description: 'Email de contact (généré automatiquement si non fourni)'
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'Marie Dupont',
        description: 'Nom du manager',
        required: false
    })
    @IsOptional()
    @IsString()
    manager?: string;

    @ApiProperty({
        example: 'actif',
        description: 'Statut du magasin',
        required: false
    })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({
        example: ['Plantes d\'intérieur', 'Mobilier de jardin'],
        description: 'Catégories supportées',
        required: false
    })
    @IsOptional()
    @IsArray()
    categories?: string[];

    @ApiProperty({
        example: 'motdepasse123',
        description: 'Mot de passe pour le responsable du magasin (optionnel, généré automatiquement si non fourni)',
        required: false
    })
    @IsOptional()
    @IsString()
    managerPassword?: string;
}