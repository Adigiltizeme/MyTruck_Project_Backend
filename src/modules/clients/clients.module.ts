import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { FixClientDatesController } from './fix-client-dates.controller';

@Module({
  controllers: [ClientsController, FixClientDatesController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule { }