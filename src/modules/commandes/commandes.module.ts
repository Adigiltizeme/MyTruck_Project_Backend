import { Module } from '@nestjs/common';
import { CommandesController } from './commandes.controller';
import { CommandesService } from './commandes.service';
import { ClientsModule } from '../clients/clients.module';
import { TrackingModule } from '../tracking/tracking.module';
import { SlotsModule } from '../slots/slots.module';
import { VehicleValidationBackendService } from './services/vehicle-validation-backend.service';

@Module({
  imports: [
    ClientsModule,
    TrackingModule,
    SlotsModule,
  ],
  controllers: [CommandesController],
  providers: [CommandesService, VehicleValidationBackendService],
  exports: [CommandesService],
})
export class CommandesModule { }