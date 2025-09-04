import { IsString, IsBoolean, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTimeSlotDto {
    @ApiProperty({ example: '07h' })
    @IsString()
    startTime: string;

    @ApiProperty({ example: '09h' })
    @IsString()
    endTime: string;

    @ApiProperty({ example: '07h-09h' })
    @IsString()
    displayName: string;

    @ApiProperty({ default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean = true;

    @ApiProperty({ default: 10, minimum: 1, maximum: 50 })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    maxCapacity?: number = 10;
}

export class UpdateTimeSlotDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    startTime?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    endTime?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    displayName?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(50)
    maxCapacity?: number;
}