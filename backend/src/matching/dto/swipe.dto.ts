import { IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwipeDto {
  @ApiProperty({ description: 'ID do usuário alvo do swipe' })
  @IsUUID()
  targetUserId: string;

  @ApiProperty({ description: 'true = like, false = ignore' })
  @IsBoolean()
  isLike: boolean;

}
