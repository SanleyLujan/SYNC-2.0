import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationRequest } from './verification-request.entity';
import { User } from '../users/entities/user.entity';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { PrivateIdentityStorageService } from './private-identity-storage.service';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationRequest, User])],
  controllers: [VerificationController],
  providers: [VerificationService, PrivateIdentityStorageService],
  exports: [VerificationService],
})
export class VerificationModule {}
