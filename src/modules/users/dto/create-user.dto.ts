import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../enums/user-role.enum';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    example: 'password123',
    description: 'Mot de passe utilisateur (minimum 6 caractères)'
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ 
    enum: UserRole,
    example: UserRole.DRIVER,
    description: 'Rôle de l\'utilisateur'
  })
  @IsEnum(UserRole)
  role: UserRole;
}