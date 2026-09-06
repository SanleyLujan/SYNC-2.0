import { IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityTimingEventDto {
  @ApiPropertyOptional({
    example: '2026-09-04T10:30:00.000Z',
    description: 'Instante original da pausa/retomada, inclusive após sincronização em background.',
  })
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}
