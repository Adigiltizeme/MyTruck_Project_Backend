import { PartialType } from '@nestjs/swagger';
import { CreateMagasinDto } from './create-magasin.dto';

export class UpdateMagasinDto extends PartialType(CreateMagasinDto) { }
