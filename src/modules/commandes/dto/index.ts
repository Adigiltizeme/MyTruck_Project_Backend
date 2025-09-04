import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
    IsString,
    IsOptional,
    IsDateString,
    IsEnum,
    IsNumber,
    IsBoolean,
    IsArray,
    IsUUID,
    ValidateNested,
    Min,
    Max,
    IsObject
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Enums pour les statuts
export enum StatutCommande {
    EN_ATTENTE = 'En attente',
    CONFIRMEE = 'Confirmée',
    ANNULEE = 'Annulée',
    MODIFIEE = 'Modifiée',
    TRANSMISE = 'Transmise'
}

export enum StatutLivraison {
    EN_ATTENTE = 'EN ATTENTE',
    CONFIRMEE = 'CONFIRMEE',
    EN_COURS = 'EN COURS DE LIVRAISON',
    LIVREE = 'LIVREE',
    ECHEC = 'ECHEC',
    ANNULEE = 'ANNULEE'
}

export enum CategorieVehicule {
    UTILITAIRE_1M3 = '1M3 (Utilitaire 150kg, 100x100x100cm)',
    CAMIONNETTE_6M3 = '6M3 (Camionnette 300kg, 260x160x125cm)',
    CAMIONNETTE_10M3 = '10M3 (Camionnette 800kg, 310x178x190cm)',
    CAMION_20M3 = '20M3 (Avec hayon 750kg, 410, 200, 210cm)'
}

export enum TypeAdresse {
    DOMICILE = 'Domicile',
    PROFESSIONNELLE = 'Professionnelle'
}

// DTOs pour les sous-objets
export class CreateClientDto {
    @ApiProperty({ example: 'Dupont' })
    @IsString()
    nom: string;

    @ApiProperty({ example: 'Jean', required: false })
    @IsOptional()
    @IsString()
    prenom?: string;

    @ApiProperty({ example: '+33123456789' })
    @IsString()
    telephone: string;

    @ApiProperty({ example: '+33987654321', required: false })
    @IsOptional()
    @IsString()
    telephoneSecondaire?: string;

    @ApiProperty({ example: '123 Rue de la Paix, 75001 Paris' })
    @IsString()
    adresseLigne1: string;

    @ApiProperty({ example: 'Bâtiment A', required: false })
    @IsOptional()
    @IsString()
    batiment?: string;

    @ApiProperty({ example: '3ème étage' })
    @IsString()
    etage: string;

    @ApiProperty({ example: '1234A' })
    @IsString()
    interphone: string;

    @ApiProperty({ example: true })
    @IsBoolean()
    ascenseur: boolean;

    @ApiProperty({ example: TypeAdresse.DOMICILE, enum: TypeAdresse, required: false })
    @IsOptional()
    @IsEnum(TypeAdresse)
    typeAdresse?: TypeAdresse;
}

export class ArticleDimensionDto {
    @ApiProperty({ example: 'art-123' })
    @IsOptional()
    @IsString()
    id?: string;

    @ApiProperty({ example: 'Palmier Kentia' })
    @IsString()
    nom: string;

    @ApiProperty({ example: 150, required: false })
    @IsOptional()
    @IsNumber()
    longueur?: number;

    @ApiProperty({ example: 60, required: false })
    @IsOptional()
    @IsNumber()
    largeur?: number;

    @ApiProperty({ example: 180, required: false })
    @IsOptional()
    @IsNumber()
    hauteur?: number;

    @ApiProperty({ example: 15.5, required: false })
    @IsOptional()
    @IsNumber()
    poids?: number;

    @ApiProperty({ example: 1 })
    @IsNumber()
    @Min(1)
    quantite: number;
}

export class ArticlePhotoDto {
    @ApiProperty({ example: 'https://res.cloudinary.com/...' })
    @IsString()
    url: string;

    @ApiProperty({ required: false })
    @IsOptional()
    file?: any; // File object (ignoré côté Backend)
}

export class CreateArticleDto {
    @ApiProperty({ example: 5, description: 'Nombre d\'articles' })
    @IsNumber()
    @Min(1)
    nombre: number;

    @ApiProperty({
        example: 'Plantes en pot, fragiles',
        required: false,
        description: 'Détails sur les articles'
    })
    @IsOptional()
    @IsString()
    details?: string;

    @ApiProperty({
        example: ['Plantes/Arbres', 'Mobilier'],
        required: false,
        description: 'Catégories d\'articles'
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    categories?: string[];

    @ApiProperty({
        type: [ArticleDimensionDto],
        required: false,
        description: 'Dimensions détaillées des articles'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ArticleDimensionDto)
    dimensions?: ArticleDimensionDto[];

    @ApiProperty({
        type: [ArticlePhotoDto],
        required: false,
        description: 'Photos des articles'
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ArticlePhotoDto)
    photos?: ArticlePhotoDto[];

    @ApiProperty({
        type: [ArticlePhotoDto],
        required: false,
        description: 'Nouvelles photos à uploader'
    })
    @IsOptional()
    @IsArray()
    newPhotos?: ArticlePhotoDto[];

    @ApiProperty({
        example: false,
        required: false,
        description: 'L\'article peut-il être incliné'
    })
    @IsOptional()
    @IsBoolean()
    canBeTilted?: boolean;
}

export class CreateCommandeDto {
    @ApiProperty({
        example: '2024-12-25',
        description: 'Date de livraison souhaitée (format YYYY-MM-DD)'
    })
    @IsDateString()
    dateLivraison: string;

    @ApiProperty({
        example: '10h-12h',
        required: false,
        description: 'Créneau de livraison'
    })
    @IsOptional()
    @IsString()
    creneauLivraison?: string;

    @ApiProperty({
        example: CategorieVehicule.CAMIONNETTE_6M3,
        enum: CategorieVehicule,
        required: false,
        description: 'Type de véhicule requis'
    })
    @IsOptional()
    @IsEnum(CategorieVehicule)
    categorieVehicule?: CategorieVehicule;

    @ApiProperty({
        example: 1,
        minimum: 0,
        maximum: 3,
        required: false,
        description: 'Nombre d\'équipiers en plus du chauffeur'
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(3)
    optionEquipier?: number;

    @ApiProperty({
        example: 45.50,
        required: false,
        description: 'Tarif HT en euros'
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    tarifHT?: number;

    @ApiProperty({
        example: false,
        required: false,
        description: 'Réserve de transport'
    })
    @IsOptional()
    @IsBoolean()
    reserveTransport?: boolean;

    @ApiProperty({
        example: 'uuid-du-magasin',
        description: 'ID du magasin qui passe la commande'
    })
    @IsUUID()
    magasinId: string;

    @ApiProperty({
        type: CreateClientDto,
        description: 'Informations du client'
    })
    @ValidateNested()
    @Type(() => CreateClientDto)
    client: CreateClientDto;

    @ApiProperty({
        type: CreateArticleDto,
        description: 'Informations sur les articles'
    })
    @ValidateNested()
    @Type(() => CreateArticleDto)
    articles: CreateArticleDto;

    @ApiProperty({
        example: ['uuid-chauffeur-1', 'uuid-chauffeur-2'],
        required: false,
        description: 'IDs des chauffeurs assignés'
    })
    @IsOptional()
    @IsArray()
    @IsUUID(4, { each: true })
    chauffeurIds?: string[];

    // Remarques
    @ApiProperty({
        example: 'Livraison à l\'étage',
        required: false,
        description: 'Remarques supplémentaires sur la commande'
    })
    @IsOptional()
    @IsString()
    remarques?: string;

    @ApiProperty({
        example: 'Jean Martin',
        required: false,
        description: 'Prénom du vendeur/interlocuteur'
    })
    @IsOptional()
    @IsString()
    prenomVendeur?: string;

    @ApiProperty({ example: 'Konaté' })
    @IsString()
    clientNom: string;

    @ApiProperty({ example: 'Keïta', required: false })
    @IsOptional()
    @IsString()
    clientPrenom?: string;

    @ApiProperty({ example: '+33650545253' })
    @IsString()
    clientTelephone: string;

    @ApiProperty({ example: '+33723212524', required: false })
    @IsOptional()
    @IsString()
    clientTelephoneSecondaire?: string;

    @ApiProperty({ example: '9 Rue des Bergeries 93230 Romainville' })
    @IsString()
    clientAdresseLigne1: string;

    @ApiProperty({ example: 'Tour 9', required: false })
    @IsOptional()
    @IsString()
    clientBatiment?: string;

    @ApiProperty({ example: '10', required: false })
    @IsString()
    clientEtage: string;

    @ApiProperty({ example: 'KK', required: false })
    @IsString()
    clientInterphone: string;

    @ApiProperty({ example: true, required: false })
    @IsBoolean()
    clientAscenseur: boolean;

    @ApiProperty({ example: 'Domicile', required: false })
    @IsOptional()
    @IsString()
    clientTypeAdresse?: string;

    @ApiProperty({ example: 5 })
    @IsNumber()
    @Min(1)
    nombreArticles: number;

    @ApiProperty({ example: 'Spécial', required: false })
    @IsOptional()
    @IsString()
    detailsArticles?: string;

    @ApiProperty({ example: ['Plantes'], required: false })
    @IsOptional()
    @IsArray()
    categoriesArticles?: string[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsArray()
    dimensionsArticles?: any[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsArray()
    photosArticles?: any[];

    @ApiProperty({ required: false })
    @IsOptional()
    @IsArray()
    newPhotosArticles?: any[];

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    canBeTilted?: boolean;

    // 🆕 CONDITIONS DE LIVRAISON
    @IsOptional()
    @IsBoolean()
    rueInaccessible?: boolean;

    @IsOptional()
    @IsBoolean()
    paletteComplete?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    parkingDistance?: number;

    @IsOptional()
    @IsBoolean()
    hasStairs?: boolean;

    @IsOptional()
    @IsNumber()
    @Min(0)
    stairCount?: number;

    @IsOptional()
    @IsBoolean()
    needsAssembly?: boolean;

    @IsOptional()
    @IsBoolean()
    isDuplex?: boolean;

    @IsOptional()
    @IsBoolean()
    deliveryToUpperFloor?: boolean;

    //requiredCrewSize
    @IsOptional()
    @IsNumber()
    @Min(0)
    requiredCrewSize?: number;

    @IsOptional()
    @IsNumber()
    heaviestArticleWeight?: number;

    @IsOptional()
    @IsBoolean()
    needsQuote?: boolean;

    @IsOptional()
    @IsString()
    validationDetails?: string;
}

export class UpdateCommandeDto extends PartialType(CreateCommandeDto) {
    @ApiProperty({
        example: StatutCommande.CONFIRMEE,
        enum: StatutCommande,
        required: false,
        description: 'Statut de la commande'
    })
    @IsOptional()
    @IsEnum(StatutCommande)
    statutCommande?: StatutCommande;

    @ApiProperty({
        example: StatutLivraison.EN_COURS,
        enum: StatutLivraison,
        required: false,
        description: 'Statut de la livraison'
    })
    @IsOptional()
    @IsEnum(StatutLivraison)
    statutLivraison?: StatutLivraison;

    @ApiProperty({
        example: ['uuid-chauffeur-1', 'uuid-chauffeur-2'],
        required: false,
        description: 'IDs des chauffeurs à assigner (via PATCH /commandes/:id)'
    })
    @IsOptional()
    @IsArray()
    @IsUUID(4, { each: true })
    chauffeurIds?: string[];

    //canBeTilted
    @ApiProperty({
        example: false,
        required: false,
        description: 'Indique si le véhicule peut être incliné'
    })
    @IsOptional()
    @IsBoolean()
    canBeTilted?: boolean;

    @ApiProperty({
        required: false,
        description: 'Conditions spéciales de livraison'
    })
    @IsOptional()
    deliveryConditions?: {
        rueInaccessible?: boolean;
        paletteComplete?: boolean;
        parkingDistance?: number;
        hasStairs?: boolean;
        stairCount?: number;
        needsAssembly?: boolean;
        isDuplex?: boolean;
        deliveryToUpperFloor?: boolean;
        requiredCrewSize?: number;
        heaviestArticleWeight?: number;
        needsQuote?: boolean;
        validationDetails?: string;
    };
}

export class AssignChauffeursDto {
    @ApiProperty({
        example: ['uuid-chauffeur-1', 'uuid-chauffeur-2'],
        description: 'IDs des chauffeurs à assigner'
    })
    @IsArray()
    @IsUUID(4, { each: true })
    chauffeurIds: string[];

    @ApiProperty({
        example: false,
        required: false,
        description: 'Remplacer tous les chauffeurs existants'
    })
    @IsOptional()
    @IsBoolean()
    replaceAll?: boolean;

    @ApiProperty({
        example: 'Confirmée',
        required: false,
        description: 'Nouveau statut de commande'
    })
    @IsOptional()
    @IsString()
    statutCommande?: string;

    @ApiProperty({
        example: 'CONFIRMEE',
        required: false,
        description: 'Nouveau statut de livraison'
    })
    @IsOptional()
    @IsString()
    statutLivraison?: string;
}

export class CommandeFiltersDto {
    @ApiProperty({ required: false, description: 'Filtrer par statut de commande' })
    @IsOptional()
    @IsEnum(StatutCommande)
    statutCommande?: StatutCommande;

    @ApiProperty({ required: false, description: 'Filtrer par statut de livraison' })
    @IsOptional()
    @IsEnum(StatutLivraison)
    statutLivraison?: StatutLivraison;

    @ApiProperty({ required: false, description: 'Filtrer par magasin' })
    @IsOptional()
    @IsUUID()
    magasinId?: string;

    @ApiProperty({ required: false, description: 'Filtrer par chauffeur' })
    @IsOptional()
    @IsUUID()
    chauffeurId?: string;

    @ApiProperty({ required: false, description: 'Date de livraison à partir de (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    dateLivraisonDebut?: string;

    @ApiProperty({ required: false, description: 'Date de livraison jusqu\'à (YYYY-MM-DD)' })
    @IsOptional()
    @IsDateString()
    dateLivraisonFin?: string;

    @ApiProperty({ required: false, description: 'Numéro d\'éléments à ignorer', type: Number })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    skip?: number;

    @ApiProperty({ required: false, description: 'Nombre d\'éléments à retourner', type: Number })
    @IsOptional()
    @Transform(({ value }) => parseInt(value))
    @IsNumber()
    take?: number;
}