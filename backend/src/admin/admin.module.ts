import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { User } from '../users/entities/user.entity';
import { UserReport } from '../users/entities/user-report.entity';
import { Feedback } from '../feedback/feedback.entity';
import { Activity } from '../activities/entities/activity.entity';
import { ActivityFeedPost } from '../activity-feed/activity-feed.entity';
import { Message } from '../chat/entities/message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserReport, Feedback, Activity, ActivityFeedPost, Message])],
  controllers: [AdminController],
})
export class AdminModule {}
