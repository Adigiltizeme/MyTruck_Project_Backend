import { Module } from '@nestjs/common';
import { ChauffeursController } from './chauffeurs.controller';
import { ChauffeursService } from './chauffeurs.service';

@Module({
  controllers: [ChauffeursController],
  providers: [ChauffeursService],
  exports: [ChauffeursService],
})
export class ChauffeursModule { }