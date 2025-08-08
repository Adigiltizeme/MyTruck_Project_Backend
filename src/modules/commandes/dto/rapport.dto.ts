import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum TypeRapport {
    ENLEVEMENT = 'ENLEVEMENT',
    LIVRAISON = 'LIVRAISON'
}

export class PhotoRapportDto {
    @ApiProperty({ example: 'https://res.cloudinary.com/...' })
    @IsString()
    url: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    filename?: string;
}

export class CreateRapportDto {
    @ApiProperty({
        example: 'Client absent, produit abîmé pendant le transport',
        description: 'Message détaillant le problème rencontré'
    })
    @IsString()
    message: string;

    @ApiProperty({
        example: TypeRapport.LIVRAISON,
        enum: TypeRapport,
        description: 'Type de rapport (ENLEVEMENT ou LIVRAISON)'
    })
    @IsEnum(TypeRapport)
    type: TypeRapport;

    @ApiProperty({
        example: 'e5269536-7cbf-4f29-b327-ceef44f3c7c0',
        description: 'ID du chauffeur ayant rencontré le problème'
    })
    @IsUUID()
    chauffeurId: string;

    @ApiProperty({
        type: [PhotoRapportDto],
        required: false,
        description: 'Photos des problèmes rencontrés (dégâts, conditions, etc.)'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PhotoRapportDto)
    photos?: PhotoRapportDto[];

    @ApiProperty({
        example: false,
        required: false,
        description: 'Indique si c\'est un rapport obligatoire (échec de livraison)'
    })
    @IsOptional()
    obligatoire?: boolean;
}

export class UpdateRapportDto {
    @ApiProperty({
        example: 'Message mis à jour avec plus de détails',
        description: 'Nouveau message du rapport',
        required: false
    })
    @IsOptional()
    @IsString()
    message?: string;

    @ApiProperty({
        type: [PhotoRapportDto],
        required: false,
        description: 'Nouvelles photos à ajouter au rapport'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PhotoRapportDto)
    newPhotos?: PhotoRapportDto[];

    @ApiProperty({
        type: [String],
        required: false,
        description: 'URLs des photos à supprimer'
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    photosToRemove?: string[];
}