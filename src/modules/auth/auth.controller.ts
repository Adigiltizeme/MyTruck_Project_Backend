import {
  Controller,
  Post,
  Get,
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
import { LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion utilisateur',
    description: 'Authentifie un utilisateur avec email/mot de passe et retourne un token JWT'
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
            email: { type: 'string', example: 'admin@mytruck.com' },
            nom: { type: 'string', example: 'Dupont' },
            prenom: { type: 'string', example: 'Jean' },
            role: { type: 'string', example: 'ADMIN' },
            status: { type: 'string', example: 'Actif' },
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

  @Post('register')
  @ApiOperation({
    summary: 'Inscription utilisateur',
    description: 'Crée un nouvel utilisateur et retourne un token JWT'
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Inscription réussie'
  })
  @ApiResponse({
    status: 409,
    description: 'Un utilisateur avec cet email existe déjà'
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
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
    return this.authService.getProfile(req.user.id);
  }
}