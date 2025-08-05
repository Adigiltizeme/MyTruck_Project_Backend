import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';

export enum StatutCommande {
    EN_ATTENTE = 'En attente',
    CONFIRMEE = 'Confirmée',
    TRANSMISE = 'Transmise',
    ANNULEE = 'Annulée',
    MODIFIEE = 'Modifiée'
}

export enum StatutLivraison {
    EN_ATTENTE = 'EN ATTENTE',
    CONFIRMEE = 'CONFIRMEE',
    ENLEVEE = 'ENLEVEE',
    EN_COURS = 'EN COURS DE LIVRAISON',
    LIVREE = 'LIVREE',
    ANNULEE = 'ANNULEE',
    ECHEC = 'ECHEC'
}

export class UpdateStatutsDto {
    @ApiProperty({
        example: StatutCommande.CONFIRMEE,
        enum: StatutCommande,
        required: false,
        description: 'Nouveau statut de la commande'
    })
    @IsOptional()
    @IsEnum(StatutCommande)
    statutCommande?: StatutCommande;

    @ApiProperty({
        example: StatutLivraison.CONFIRMEE,
        enum: StatutLivraison,
        required: false,
        description: 'Nouveau statut de livraison'
    })
    @IsOptional()
    @IsEnum(StatutLivraison)
    statutLivraison?: StatutLivraison;

    @ApiProperty({
        example: 'Confirmation manuelle par admin',
        required: false,
        description: 'Raison du changement de statut'
    })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiProperty({
        example: false,
        required: false,
        description: 'Forcer la mise à jour même si transition invalide'
    })
    @IsOptional()
    @IsBoolean()
    forceUpdate?: boolean;
}