import { DeleteDateColumn } from 'typeorm';
import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity('gamification_rewards')
@Index(['user_id', 'source'], { unique: true })
@Index(['user_id', 'day'])
export class Reward {
  // Retained for security; excluded from ordinary ORM reads and joins.
  @DeleteDateColumn({ nullable: true, select: false })
  inactiveAt?: Date | null;

  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() user_id: string;
  @ManyToOne(() => User, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'user_id' }) user: User;
  @Column({ length: 120 }) source: string;
  @Column({ length: 10 }) day: string;
  @Column({ type: 'integer', default: 0 }) xp: number;
  @Column({ type: 'simple-json', nullable: true }) data: any;
  @CreateDateColumn() createdAt: Date;
}
