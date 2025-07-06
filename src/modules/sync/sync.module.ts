import { Module } from '@nestjs/common';
import { AirtableSyncService } from './airtable-sync.service';
import { SyncController } from './sync.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SyncController],
    providers: [AirtableSyncService],
    exports: [AirtableSyncService],
})
export class SyncModule { }