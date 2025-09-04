import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
    @ApiProperty({ example: 'ancien_mot_de_passe' })
    @IsString()
    currentPassword: string;

    @ApiProperty({ example: 'nouveau_mot_de_passe' })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters long' })
    newPassword: string;
}