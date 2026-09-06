import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum ReportReason {
  INAPPROPRIATE = 'inappropriate',
  SPAM = 'spam',
  FAKE_PROFILE = 'fake_profile',
  HARASSMENT = 'harassment',
  OTHER = 'other',
}

export enum ModerationStatus {
  PENDING = 'pending',
  DISMISSED = 'dismissed',
  ACTIONED = 'actioned',
}

@Entity('user_reports')
export class UserReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  reporter_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column()
  reported_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reported_id' })
  reported: User;

  @Column({ type: 'varchar' })
  reason: ReportReason;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', default: ModerationStatus.PENDING })
  status: ModerationStatus;

  @Column({ type: 'varchar', nullable: true })
  reviewed_by: string | null;

  @Column({ type: process.env.NODE_ENV === 'production' ? 'timestamp' : 'datetime', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
