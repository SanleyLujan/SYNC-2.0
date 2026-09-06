import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/entities/user.entity';

export enum VerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('verification_requests')
export class VerificationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Apenas chaves do bucket privado. URLs assinadas nunca são persistidas.
  @Column({ type: 'text', nullable: true, select: false })
  selfieKey: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  documentFrontKey: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  documentBackKey: string | null;

  @Column({ type: 'varchar', default: VerificationStatus.PENDING })
  status: VerificationStatus;

  @Column({ type: 'varchar', nullable: true })
  reviewed_by: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: process.env.NODE_ENV === 'production' ? 'timestamp' : 'datetime', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
