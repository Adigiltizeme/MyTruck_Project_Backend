import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto';
import { UserRole } from '../../common/types/user.types';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) { }

  async findAll(params: {
    skip?: number;
    take?: number;
    where?: any; // Utilisation d'any temporairement jusqu'à la génération Prisma
    orderBy?: any;
  }) {
    const { skip, take, where, orderBy } = params;

    return this.prisma.user.findMany({
      skip,
      take,
      where,
      orderBy: orderBy || { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        status: true,
        magasin: {
          select: {
            id: true,
            nom: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        status: true,
        magasin: {
          select: {
            id: true,
            nom: true,
            adresse: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        magasin: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });
  }

  async create(createUserDto: CreateUserDto) {
    const { email, password, ...userData } = createUserDto;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Un utilisateur avec cet email existe déjà');
    }

    // Hashage du mot de passe
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        ...userData,
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        status: true,
        magasin: {
          select: {
            id: true,
            nom: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`✅ Utilisateur créé: ${email}`);
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    await this.findOne(id); // Vérifier que l'utilisateur existe

    const updateData: any = { ...updateUserDto };

    // Si un nouveau mot de passe est fourni, le hasher
    if (updateUserDto.password) {
      const saltRounds = 12;
      updateData.password = await bcrypt.hash(updateUserDto.password, saltRounds);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        telephone: true,
        role: true,
        status: true,
        magasin: {
          select: {
            id: true,
            nom: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`✅ Utilisateur mis à jour: ${user.email}`);
    return user;
  }

  async remove(id: string) {
    const existingUser = await this.findOne(id);

    await this.prisma.user.delete({
      where: { id },
    });

    this.logger.log(`✅ Utilisateur supprimé: ${existingUser.email}`);
    return { message: 'Utilisateur supprimé avec succès' };
  }

  async findByRole(role: string) {
    return this.prisma.user.findMany({
      where: { role: role as any },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        status: true,
        magasin: {
          select: {
            id: true,
            nom: true,
          },
        },
      },
    });
  }

  async findByMagasin(magasinId: string) {
    return this.prisma.user.findMany({
      where: { magasinId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        status: true,
      },
    });
  }
}