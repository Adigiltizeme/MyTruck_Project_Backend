import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEmail } from 'class-validator';

export class CreateMagasinDto {
    @ApiProperty({
        example: 'Truffaut Ivry',
        description: 'Nom du magasin',
    })
    @IsString()
    nom: string;

    @ApiProperty({
        example: '36 Rue Ernest Renan, 94200 Ivry-sur-Seine',
        description: 'Adresse complète du magasin',
    })
    @IsString()
    adresse: string;

    @ApiProperty({
        example: '+33140253030',
        description: 'Numéro de téléphone du magasin',
        required: false,
    })
    @IsOptional()
    @IsString()
    telephone?: string;

    @ApiProperty({
        example: 'contact@truffaut-ivry.com',
        description: 'Adresse email du magasin',
        required: false,
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiProperty({
        example: 'Actif',
        description: 'Statut du magasin',
        default: 'Actif',
        required: false,
    })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({
        example: ['Plantes/Arbres', 'Mobilier'],
        description: 'Catégories d\'articles vendus',
        required: false,
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    categories?: string[];
}

export class UpdateMagasinDto extends PartialType(CreateMagasinDto) { }