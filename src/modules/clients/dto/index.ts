import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsBoolean,
    IsEnum
} from 'class-validator';

export enum TypeAdresseClient {
    DOMICILE = 'Domicile',
    PROFESSIONNELLE = 'Professionnelle'
}

export class CreateClientDto {
    @ApiProperty({
        example: 'Dupont',
        description: 'Nom de famille du client'
    })
    @IsString()
    nom: string;

    @ApiProperty({
        example: 'Jean',
        description: 'Prénom du client',
        required: false
    })
    @IsOptional()
    @IsString()
    prenom?: string;

    @ApiProperty({
        example: '+33123456789',
        description: 'Numéro de téléphone principal'
    })
    @IsString()
    telephone: string;

    @ApiProperty({
        example: '+33987654321',
        description: 'Numéro de téléphone secondaire',
        required: false
    })
    @IsOptional()
    @IsString()
    telephoneSecondaire?: string;

    @ApiProperty({
        example: '123 Rue de la Paix',
        description: 'Adresse de livraison (ligne 1)'
    })
    @IsString()
    adresseLigne1: string;

    @ApiProperty({
        example: 'Bâtiment A',
        description: 'Nom du bâtiment',
        required: false
    })
    @IsOptional()
    @IsString()
    batiment?: string;

    @ApiProperty({
        example: '3ème étage',
        description: 'Étage',
        required: false
    })
    @IsOptional()
    @IsString()
    etage?: string;

    @ApiProperty({
        example: '1234A',
        description: 'Code interphone',
        required: false
    })
    @IsOptional()
    @IsString()
    interphone?: string;

    @ApiProperty({
        example: true,
        description: 'Présence d\'un ascenseur',
        required: false
    })
    @IsOptional()
    @IsBoolean()
    ascenseur?: boolean;

    @ApiProperty({
        example: TypeAdresseClient.DOMICILE,
        enum: TypeAdresseClient,
        description: 'Type d\'adresse',
        required: false
    })
    @IsOptional()
    @IsEnum(TypeAdresseClient)
    typeAdresse?: TypeAdresseClient;
}

export class UpdateClientDto extends PartialType(CreateClientDto) { }

export class ClientFiltersDto {
    @ApiProperty({ required: false, description: 'Rechercher par nom' })
    @IsOptional()
    @IsString()
    nom?: string;

    @ApiProperty({ required: false, description: 'Rechercher par ville' })
    @IsOptional()
    @IsString()
    ville?: string;

    @ApiProperty({ required: false, description: 'Filtrer par type d\'adresse', enum: TypeAdresseClient })
    @IsOptional()
    @IsEnum(TypeAdresseClient)
    typeAdresse?: TypeAdresseClient;

    @ApiProperty({ required: false, description: 'Numéro d\'éléments à ignorer', type: Number })
    @IsOptional()
    skip?: number;

    @ApiProperty({ required: false, description: 'Nombre d\'éléments à retourner', type: Number })
    @IsOptional()
    take?: number;
}

export * from './client-response.dto';