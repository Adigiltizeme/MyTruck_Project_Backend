import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateSlotRestrictionDto {
    @ApiProperty({ example: '2025-12-25' })
    @IsString()
    date: string;

    @ApiProperty()
    @IsString()
    slotId: string;

    @ApiProperty({ default: true })
    @IsOptional()
    @IsBoolean()
    isBlocked?: boolean = true;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    temporaryUntil?: string;
}