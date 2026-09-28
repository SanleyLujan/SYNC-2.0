import { DeleteDateColumn } from 'typeorm';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Match } from '../../matching/entities/match.entity';

@Entity('messages')
@Index(['match_id', 'createdAt'])           // getMessages() + conversation sort
@Index(['match_id', 'isRead', 'sender_id']) // batch unread count query
export class Message {
  // Retained for security; excluded from ordinary ORM reads and joins.
  @DeleteDateColumn({ nullable: true, select: false })
  inactiveAt?: Date | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Match, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: Match;

  @Column()
  match_id: string;

  @ManyToOne(() => User, (user) => user.sentMessages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column()
  sender_id: string;

  @Column({ type: 'text' })
  content: string;

  // 'text' | 'audio' | 'image' | 'location'
  @Column({ type: 'varchar', length: 10, default: 'text' })
  type: string;

  @Column({ default: false })
  isRead: boolean;

  // Reações: mapa emoji -> lista de userIds que reagiram. Ex.: { "🔥": ["u1"] }
  @Column({ type: process.env.NODE_ENV === 'production' ? 'jsonb' : 'simple-json', nullable: true })
  reactions: Record<string, string[]> | null;

  @CreateDateColumn()
  createdAt: Date;
}
