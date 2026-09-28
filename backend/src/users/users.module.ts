import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserBlock } from './entities/user-block.entity';
import { UserReport } from './entities/user-report.entity';
import { Match } from '../matching/entities/match.entity';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserBlock, UserReport, Match]), VerificationModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
