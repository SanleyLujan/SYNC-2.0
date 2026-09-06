import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityFeedController } from './activity-feed.controller';
import { ActivityFeedService } from './activity-feed.service';
import { ActivityFeedPost } from './activity-feed.entity';
import { FeedComment } from './feed-comment.entity';
import { FeedLike } from './feed-like.entity';
import { Match } from '../matching/entities/match.entity';
import { PostReport } from './post-report.entity';
import { FeedCommentReaction } from './feed-comment-reaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityFeedPost, FeedComment, FeedLike, Match, PostReport, FeedCommentReaction])],
  controllers: [ActivityFeedController],
  providers: [ActivityFeedService],
  exports: [ActivityFeedService],
})
export class ActivityFeedModule {}
