import { Module } from '@nestjs/common';
import { SlotsService } from './slots.service';
import { SlotsController } from './slots.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SlotsController],
    providers: [SlotsService],
    exports: [SlotsService]
})
export class SlotsModule { }