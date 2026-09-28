import { DeleteDateColumn } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ActivityFeedPost } from './activity-feed.entity';

@Entity('feed_comments')
@Index(['post_id', 'createdAt']) // getComments() filters by post_id + sorts
export class FeedComment {
  // Retained for security; excluded from ordinary ORM reads and joins.
  @DeleteDateColumn({ nullable: true, select: false })
  inactiveAt?: Date | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id' })
  post_id: string;

  @ManyToOne(() => ActivityFeedPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: ActivityFeedPost;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'simple-json', nullable: true })
  mentioned_user_ids: string[] | null;

  @CreateDateColumn()
  createdAt: Date;
}
