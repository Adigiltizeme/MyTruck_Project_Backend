import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '../../../common/types/user.types';

export class LoginDto {
    @ApiProperty({
        example: 'admin@mytruck.com',
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
}

export class RegisterDto {
    @ApiProperty({
        example: 'admin@mytruck.com',
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
        example: 'Dupont',
        description: 'Nom de famille',
    })
    @IsString()
    nom: string;

    @ApiProperty({
        example: 'Jean',
        description: 'Prénom',
        required: false,
    })
    @IsOptional()
    @IsString()
    prenom?: string;

    @ApiProperty({
        example: 'ADMIN',
        description: 'Rôle de l\'utilisateur',
        enum: UserRole,
    })
    @IsEnum(UserRole, { message: 'Rôle invalide' })
    role: UserRole;

    @ApiProperty({
        example: 'uuid-du-magasin',
        description: 'ID du magasin (optionnel)',
        required: false,
    })
    @IsOptional()
    @IsUUID(4, { message: 'Format UUID invalide pour magasinId' })
    magasinId?: string;
}