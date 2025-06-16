import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/types/user.types';

@ApiTags('Utilisateurs')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  @ApiOperation({
    summary: 'Créer un utilisateur',
    description: 'Crée un nouvel utilisateur (Admin/Direction uniquement)'
  })
  @ApiResponse({ status: 201, description: 'Utilisateur créé avec succès' })
  @ApiResponse({ status: 409, description: 'Un utilisateur avec cet email existe déjà' })
  @ApiResponse({ status: 403, description: 'Accès interdit' })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  @ApiOperation({
    summary: 'Lister les utilisateurs',
    description: 'Récupère la liste des utilisateurs avec pagination'
  })
  @ApiQuery({ name: 'skip', type: 'number', required: false, description: 'Nombre d\'éléments à ignorer' })
  @ApiQuery({ name: 'take', type: 'number', required: false, description: 'Nombre d\'éléments à récupérer' })
  @ApiQuery({ name: 'role', type: 'string', required: false, description: 'Filtrer par rôle' })
  @ApiQuery({ name: 'status', type: 'string', required: false, description: 'Filtrer par statut' })
  @ApiResponse({ status: 200, description: 'Liste des utilisateurs récupérée avec succès' })
  async findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const where: any = {};

    if (role) where.role = role;
    if (status) where.status = status;

    return this.usersService.findAll({
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
      where,
    });
  }

  @Get('by-role/:role')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  @ApiOperation({
    summary: 'Utilisateurs par rôle',
    description: 'Récupère les utilisateurs d\'un rôle spécifique'
  })
  @ApiResponse({ status: 200, description: 'Utilisateurs récupérés avec succès' })
  async findByRole(@Param('role') role: string) {
    return this.usersService.findByRole(role);
  }

  @Get('by-magasin/:magasinId')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION, UserRole.MAGASIN)
  @ApiOperation({
    summary: 'Utilisateurs par magasin',
    description: 'Récupère les utilisateurs d\'un magasin spécifique'
  })
  @ApiResponse({ status: 200, description: 'Utilisateurs récupérés avec succès' })
  async findByMagasin(@Param('magasinId', ParseUUIDPipe) magasinId: string) {
    return this.usersService.findByMagasin(magasinId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Détails d\'un utilisateur',
    description: 'Récupère les détails d\'un utilisateur par son ID'
  })
  @ApiResponse({ status: 200, description: 'Utilisateur trouvé' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.DIRECTION)
  @ApiOperation({
    summary: 'Modifier un utilisateur',
    description: 'Met à jour les informations d\'un utilisateur'
  })
  @ApiResponse({ status: 200, description: 'Utilisateur mis à jour avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Supprimer un utilisateur',
    description: 'Supprime un utilisateur (Admin uniquement)'
  })
  @ApiResponse({ status: 200, description: 'Utilisateur supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}