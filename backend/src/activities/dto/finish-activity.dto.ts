import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, Max, Min, ValidateNested } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AddPointDto } from './add-point.dto';

export class FinishActivityDto {
  @ApiPropertyOptional({
    type: [AddPointDto],
    description: 'Cópia local da rota para reconciliar pontos não confirmados pelo WebSocket.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20_000)
  @ValidateNested({ each: true })
  @Type(() => AddPointDto)
  points?: AddPointDto[];

  @ApiPropertyOptional({
    description: 'Duração ativa medida pelo app, sem countdown nem pausas.',
    minimum: 0,
    maximum: 604800,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(604_800)
  activeDurationSeconds?: number;

  @ApiPropertyOptional({
    description: 'Voltas marcadas manualmente no app.',
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  laps?: Array<{ number: number; time: number; distance: number }>;
}
