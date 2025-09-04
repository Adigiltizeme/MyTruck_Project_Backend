import {
  Controller,
  Get,
  Patch,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { AuthService } from '../auth/auth.service';
import { UpdateProfileDto, UpdatePasswordDto } from '../auth/dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Profile Management')
@Controller('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class MeController {
  constructor(private readonly authService: AuthService) { }

  @Get()
  @ApiOperation({
    summary: 'Récupérer son profil',
    description: 'Récupère les informations du profil de l\'utilisateur connecté'
  })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur récupéré avec succès',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Jean Dupont' },
        email: { type: 'string', example: 'jean.dupont@exemple.com' },
        phone: { type: 'string', example: '0123456789' },
        role: { type: 'string', example: 'chauffeur' },
        id: { type: 'string', example: 'user-uuid' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT invalide ou expiré'
  })
  async getMe(@Request() req) {
    return this.authService.getMe(req.user.sub, req.user.entityType);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mettre à jour son profil',
    description: 'Mettre à jour les informations générales du profil de l\'utilisateur connecté'
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profil mis à jour avec succès',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Profil mis à jour' }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT invalide ou expiré'
  })
  async updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.sub, req.user.entityType, updateProfileDto);
  }

  @Patch('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Changer son mot de passe',
    description: 'Changer le mot de passe de l\'utilisateur connecté'
  })
  @ApiBody({ type: UpdatePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe mis à jour avec succès',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Mot de passe mis à jour' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Mot de passe actuel incorrect'
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT invalide ou expiré'
  })
  async updatePassword(@Request() req, @Body() updatePasswordDto: UpdatePasswordDto) {
    return this.authService.updatePassword(req.user.sub, req.user.entityType, updatePasswordDto);
  }
}