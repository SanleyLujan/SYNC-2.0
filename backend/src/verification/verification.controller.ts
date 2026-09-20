import { Controller, Get, Header, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { VerificationService } from './verification.service';

@ApiTags('Verification')
@Controller('api/verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VerificationController {
  constructor(private readonly service: VerificationService) {}

  @Get('status')
  @Header('Cache-Control', 'no-store, private')
  status(@CurrentUser() user: User) {
    return this.service.status(user.id);
  }

  @Post('requests')
  @Throttle({ default: { ttl: 86_400_000, limit: 3 } })
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'selfie', maxCount: 1 },
    { name: 'documentFront', maxCount: 1 },
    { name: 'documentBack', maxCount: 1 },
  ], { storage: memoryStorage(), limits: { fileSize: 6 * 1024 * 1024, files: 3 } }))
  @ApiOperation({ summary: 'Enviar pedido de verificação para análise manual' })
  submit(
    @CurrentUser() user: User,
    @UploadedFiles() files: { selfie?: Express.Multer.File[]; documentFront?: Express.Multer.File[]; documentBack?: Express.Multer.File[] },
  ) {
    return this.service.submit(user.id, files || {});
  }
}
