import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ChauffeursController } from './chauffeurs.controller';
import { ChauffeursService } from './chauffeurs.service';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    PrismaModule,
    TrackingModule
  ],
  controllers: [ChauffeursController],
  providers: [ChauffeursService],
  exports: [ChauffeursService],
})
export class ChauffeursModule { }