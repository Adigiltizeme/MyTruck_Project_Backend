import { ApiProperty } from '@nestjs/swagger';

export class ClientResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    nom: string;

    @ApiProperty()
    prenom?: string;

    @ApiProperty()
    telephone?: string;

    @ApiProperty()
    telephoneSecondaire?: string;

    @ApiProperty()
    adresseLigne1: string;

    @ApiProperty()
    typeAdresse?: string;

    @ApiProperty()
    consentGiven: boolean;

    @ApiProperty()
    dataRetentionUntil: Date;

    @ApiProperty()
    lastActivityAt: Date;

    @ApiProperty()
    pseudonymized: boolean;

    @ApiProperty()
    deletionRequested: boolean;

    @ApiProperty()
    _count?: {
        commandes: number;
    };
}

export class ClientsListResponseDto {
    @ApiProperty({ type: [ClientResponseDto] })
    data: ClientResponseDto[];

    @ApiProperty()
    meta: {
        total: number;
        skip: number;
        take: number;
        hasMore: boolean;
    };
}