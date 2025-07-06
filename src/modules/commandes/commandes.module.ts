import { Module } from '@nestjs/common';
import { CommandesController } from './commandes.controller';
import { CommandesService } from './commandes.service';
import { ClientsModule } from '../clients/clients.module';
import { TrackingModule } from '../tracking/tracking.module';

@Module({
  imports: [
    ClientsModule,
    TrackingModule
  ],
  controllers: [CommandesController],
  providers: [CommandesService],
  exports: [CommandesService],
})
export class CommandesModule { }