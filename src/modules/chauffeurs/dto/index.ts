import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsEmail,
    IsNumber,
    Min,
    Max
} from 'class-validator';

export class CreateChauffeurDto {
    @ApiProperty({
        example: 'Dupont',
        description: 'Nom de famille du chauffeur'
    })
    @IsString()
    nom: string;

    @ApiProperty({
        example: 'Jean',
        description: 'Prénom du chauffeur'
    })
    @IsString()
    prenom: string;

    @ApiProperty({
        example: '+33123456789',
        description: 'Numéro de téléphone du chauffeur',
        required: false
    })
    @IsOptional()
    @IsString()
    telephone?: string;

    @ApiProperty({
        example: 'jean.dupont@mytruck.com',
        description: 'Adresse email du chauffeur (généré automatiquement si non fourni)'
    })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: 'Actif',
        description: 'Statut du chauffeur',
        default: 'Actif',
        required: false
    })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({
        example: 2.3522,
        description: 'Longitude de la position actuelle',
        required: false
    })
    @IsOptional()
    @IsNumber()
    longitude?: number;

    @ApiProperty({
        example: 48.8566,
        description: 'Latitude de la position actuelle',
        required: false
    })
    @IsOptional()
    @IsNumber()
    latitude?: number;

    @ApiProperty({
        example: 5,
        description: 'Note d\'évaluation (1-5)',
        minimum: 1,
        maximum: 5,
        required: false
    })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(5)
    notes?: number;

    @ApiProperty({
        example: 'motdepasse123',
        description: 'Mot de passe pour la connexion (optionnel, généré automatiquement si non fourni)',
        required: false
    })
    @IsOptional()
    @IsString()
    password?: string;
}

export class UpdateChauffeurDto extends PartialType(CreateChauffeurDto) { }

export class UpdateChauffeurPasswordDto {
    @ApiProperty({
        example: 'nouveaumotdepasse123',
        description: 'Nouveau mot de passe'
    })
    @IsString()
    password: string;
}

export class GeneratePasswordDto {
    @ApiProperty({
        example: true,
        description: 'Générer un nouveau mot de passe automatiquement',
        required: false
    })
    @IsOptional()
    generateRandom?: boolean;
}

export class ChauffeurFiltersDto {
    @ApiProperty({ required: false, description: 'Filtrer par statut' })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({ required: false, description: 'Note minimum' })
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(5)
    noteMinimum?: number;

    @ApiProperty({ required: false, description: 'Numéro d\'éléments à ignorer', type: Number })
    @IsOptional()
    skip?: number;

    @ApiProperty({ required: false, description: 'Nombre d\'éléments à retourner', type: Number })
    @IsOptional()
    take?: number;
}