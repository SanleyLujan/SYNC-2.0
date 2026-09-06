import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ActivityFeedPost } from './activity-feed.entity';
import { ModerationStatus, ReportReason } from '../users/entities/user-report.entity';

@Entity('post_reports')
@Unique(['reporter_id', 'post_id'])
export class PostReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reporter_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column()
  post_id: string;

  @ManyToOne(() => ActivityFeedPost, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: ActivityFeedPost;

  @Column({ type: 'varchar' })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', default: ModerationStatus.PENDING })
  status: ModerationStatus;

  @Column({ type: 'varchar', nullable: true })
  reviewed_by: string | null;

  @Column({ type: process.env.NODE_ENV === 'production' ? 'timestamp' : 'datetime', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
