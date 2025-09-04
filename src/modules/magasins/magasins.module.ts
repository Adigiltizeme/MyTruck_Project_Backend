import { Module } from '@nestjs/common';
import { MagasinsController } from './magasins.controller';
import { MagasinsService } from './magasins.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Module({
    controllers: [MagasinsController],
    providers: [MagasinsService, PrismaService],
    exports: [MagasinsService]
})
export class MagasinsModule { }