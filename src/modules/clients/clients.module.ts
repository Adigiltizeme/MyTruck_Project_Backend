import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { FixClientDatesController } from './fix-client-dates.controller';
import { TempFixController } from './temp-fix.controller';

@Module({
  controllers: [ClientsController, FixClientDatesController, TempFixController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule { }