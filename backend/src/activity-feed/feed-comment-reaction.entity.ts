import { DeleteDateColumn } from 'typeorm';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { FeedComment } from './feed-comment.entity';
import { User } from '../users/entities/user.entity';

@Entity('feed_comment_reactions')
@Unique(['comment_id', 'user_id', 'emoji'])
export class FeedCommentReaction {
  // Retained for security; excluded from ordinary ORM reads and joins.
  @DeleteDateColumn({ nullable: true, select: false })
  inactiveAt?: Date | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  comment_id: string;

  @ManyToOne(() => FeedComment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: FeedComment;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 12 })
  emoji: string;

  @CreateDateColumn()
  createdAt: Date;
}
