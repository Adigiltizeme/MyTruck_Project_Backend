import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
    @ApiProperty({ example: 'Jean Dupont' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ example: 'jean.dupont@exemple.com' })
    @IsOptional()
    @IsEmail({}, { message: 'Invalid email format' })
    email?: string;

    @ApiProperty({ example: '0123456789' })
    @IsOptional()
    @IsString()
    phone?: string;
}