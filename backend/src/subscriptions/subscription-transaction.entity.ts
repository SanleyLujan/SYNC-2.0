import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

export type SubscriptionTransactionStatus = 'pending' | 'paid' | 'canceled';

@Entity('subscription_transactions')
export class SubscriptionTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  tier: string;

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: SubscriptionTransactionStatus;

  @Column({ type: process.env.NODE_ENV === 'production' ? 'timestamp' : 'datetime', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
