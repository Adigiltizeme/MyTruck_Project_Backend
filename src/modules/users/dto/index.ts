import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
    IsEmail,
    IsString,
    IsOptional,
    MinLength,
    IsEnum,
    IsUUID
} from 'class-validator';
import { UserRole } from '../../../common/types/user.types';

export class CreateUserDto {
    @ApiProperty({
        example: 'john.doe@example.com',
        description: 'Adresse email de l\'utilisateur',
    })
    @IsEmail({}, { message: 'Format d\'email invalide' })
    email: string;

    @ApiProperty({
        example: 'motdepasse123',
        description: 'Mot de passe (minimum 6 caractères)',
        minLength: 6,
    })
    @IsString()
    @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
    password: string;

    @ApiProperty({
        example: 'Doe',
        description: 'Nom de famille',
    })
    @IsString()
    nom: string;

    @ApiProperty({
        example: 'John',
        description: 'Prénom',
        required: false,
    })
    @IsOptional()
    @IsString()
    prenom?: string;

    @ApiProperty({
        example: '+33123456789',
        description: 'Numéro de téléphone',
        required: false,
    })
    @IsOptional()
    @IsString()
    telephone?: string;

    @ApiProperty({
        example: 'MAGASIN',
        description: 'Rôle de l\'utilisateur',
        enum: UserRole,
    })
    @IsEnum(UserRole, { message: 'Rôle invalide' })
    role: UserRole;

    @ApiProperty({
        example: 'Actif',
        description: 'Statut de l\'utilisateur',
        default: 'Actif',
        required: false,
    })
    @IsOptional()
    @IsString()
    status?: string;

    @ApiProperty({
        example: 'uuid-du-magasin',
        description: 'ID du magasin associé',
        required: false,
    })
    @IsOptional()
    @IsUUID(4, { message: 'Format UUID invalide pour magasinId' })
    magasinId?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
    @ApiProperty({
        example: 'nouveaumotdepasse123',
        description: 'Nouveau mot de passe (optionnel)',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MinLength(6, { message: 'Le mot de passe doit contenir au moins 6 caractères' })
    password?: string;
}