import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { UserAchievement } from './entities/achievement.entity';
import { Activity } from '../activities/entities/activity.entity';
import { Match } from '../matching/entities/match.entity';
import { Like } from '../matching/entities/like.entity';
import { Event } from '../events/entities/event.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAchievement, Activity, Match, Like, Event]),
    NotificationsModule,
    GamificationModule,
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
