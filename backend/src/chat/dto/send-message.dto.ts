import { IsString, IsUUID, IsNotEmpty, MaxLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'ID do match (conversa)' })
  @IsUUID()
  matchId: string;

  // Texto: até 1000 chars. Mídia: URL (/uploads/media/...) ou JSON de localização,
  // não mais base64 — por isso 4000 cobre URLs com folga (antes era 2MB!).
  @ApiProperty({ description: 'Texto da mensagem, URL da mídia ou JSON de localização' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4_000)
  content: string;

  @ApiPropertyOptional({ enum: ['text', 'audio', 'image', 'location'], default: 'text' })
  @IsOptional()
  @IsIn(['text', 'audio', 'image', 'location'])
  type?: string;
}
