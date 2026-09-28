import { DeleteDateColumn } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Activity } from './activity.entity';

// Kudos = like da Strava. Idempotente (1 por user por activity).
@Entity('activity_kudos')
@Unique(['activity_id', 'user_id'])
export class ActivityKudos {
  // Retained for security; excluded from ordinary ORM reads and joins.
  @DeleteDateColumn({ nullable: true, select: false })
  inactiveAt?: Date | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Activity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'activity_id' })
  activity: Activity;

  @Column()
  activity_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @CreateDateColumn()
  createdAt: Date;
}
