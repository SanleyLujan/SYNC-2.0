import { IsString, IsNotEmpty, IsDateString, IsIn, IsInt, IsOptional, Max, Min, IsBoolean, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested, IsLatitude, IsLongitude } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const VALID_SPORTS = [
  'walking', 'running', 'cycling', 'swimming', 'football', 'basketball',
  'tennis', 'yoga', 'gym', 'hiking', 'crossfit', 'martial_arts', 'dance',
];

export class PlannedCoordinateDto {
  @IsLatitude()
  latitude: number;
  @IsLongitude()
  longitude: number;
}

export class CreateActivityDto {
  @IsOptional()
  @IsBoolean()
  segmentsOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  territoryOptIn?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => PlannedCoordinateDto)
  plannedRoute?: PlannedCoordinateDto[];

  @ApiProperty({ example: 'running', enum: VALID_SPORTS })
  @IsString()
  @IsNotEmpty()
  @IsIn(VALID_SPORTS, { message: `sport deve ser um dos valores: ${VALID_SPORTS.join(', ')}` })
  sport: string;

  @ApiPropertyOptional({ example: '2026-04-10T07:30:00Z', description: 'Compatibilidade; o servidor define o início real.' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ enum: ['distance', 'duration'] })
  @IsOptional()
  @IsIn(['distance', 'duration'])
  goalType?: 'distance' | 'duration';

  @ApiPropertyOptional({ description: 'Metros para distância ou segundos para duração.' })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(1_000_000)
  goalValue?: number;
}
