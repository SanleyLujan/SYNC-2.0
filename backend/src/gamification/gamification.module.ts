import { Controller, Get, Header, Module, UseGuards } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Reward } from './reward.entity';
import { GamificationService } from './gamification.service';
import { Throttle } from '@nestjs/throttler';

@Controller('api/gamification') @UseGuards(JwtAuthGuard)
class GamificationController {
  constructor(private readonly service: GamificationService) {}
  @Get('me') @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store, private')
  summary(@CurrentUser() user: User) { return this.service.summary(user.id); }
}
@Module({ imports: [TypeOrmModule.forFeature([Reward])], controllers: [GamificationController], providers: [GamificationService], exports: [GamificationService] })
export class GamificationModule {}
