import {
  Controller,
  Post,
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

import { AuthService } from './auth.service';
import { LoginDto, UpdateProfileDto, UpdatePasswordDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion utilisateur',
    description: 'Authentifie un utilisateur (magasin, chauffeur ou admin) avec email/mot de passe et retourne un token JWT'
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'uuid' },
            email: { type: 'string', example: 'boulogne@truffaut.com' },
            nom: { type: 'string', example: 'Truffaut Boulogne' },
            role: { type: 'string', example: 'MAGASIN' },
            status: { type: 'string', example: 'active' },
            magasin: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                nom: { type: 'string' }
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Email ou mot de passe incorrect'
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Profil utilisateur',
    description: 'Récupère les informations du profil de l\'utilisateur connecté'
  })
  @ApiResponse({
    status: 200,
    description: 'Profil utilisateur récupéré avec succès'
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT invalide ou expiré'
  })
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.sub, req.user.entityType);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Déconnexion',
    description: 'Invalide le token d\'accès actuel'
  })
  async logout() {
    return { message: 'Déconnexion réussie' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
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