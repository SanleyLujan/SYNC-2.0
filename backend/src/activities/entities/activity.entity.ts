import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ActivityPoint } from './activity-point.entity';

// Atividade esportiva registrada (tipo Strava)
@Entity('activities')
export class Activity {
  @Column({ default: false })
  segmentsOptIn: boolean;

  @Column({ default: false })
  territoryOptIn: boolean;

  @Column({ default: false })
  territoryProcessed: boolean;

  @Column({ type: 'simple-json', nullable: true, select: false })
  plannedRoute: Array<{ latitude: number; longitude: number }> | null;

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.activities, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: string;

  @Column({ length: 50 })
  sport: string;

  @Column()
  startTime: Date;

  @Column({ nullable: true })
  endTime: Date;

  // Estado de pausa persistido para que a duração não conte intervalos parados.
  @Column({ type: process.env.NODE_ENV === 'production' ? 'timestamp' : 'datetime', nullable: true })
  pausedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  pausedDuration: number;

  // Distancia em metros
  @Column({ type: 'real', default: 0 })
  distance: number;

  // Duracao em segundos
  @Column({ type: 'integer', default: 0 })
  duration: number;

  // Pace medio em min/km
  @Column({ type: 'real', nullable: true })
  avgPace: number | null;

  // Velocidade media em km/h
  @Column({ type: 'real', nullable: true })
  avgSpeed: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  goalType: 'distance' | 'duration' | null;

  // Metros quando goalType=distance; segundos quando goalType=duration.
  @Column({ type: 'integer', nullable: true })
  goalValue: number | null;

  @Column({ type: process.env.NODE_ENV === 'production' ? 'timestamp' : 'datetime', nullable: true })
  goalReachedAt: Date | null;

  @Column({ type: 'integer', default: 0 })
  calories: number;

  @Column({ type: 'real', default: 0 })
  elevationGain: number;

  @Column({ type: 'simple-json', nullable: true })
  laps: Array<{ number: number; time: number; distance: number }> | null;

  @Column({ default: false })
  isCompleted: boolean;

  // Token público para compartilhar tracking ao vivo. null = não compartilhado.
  @Column({ type: 'varchar', nullable: true })
  liveToken: string | null;

  // Expiração do token público — auto-revoga após 24h ou ao finalizar.
  @Column({ type: process.env.NODE_ENV === 'production' ? 'timestamp' : 'datetime', nullable: true })
  liveTokenExpiresAt: Date | null;

  // Fotos do treino (CSV de URLs) — máx 5
  @Column({ type: 'simple-array', nullable: true })
  photoUrls: string[] | null;

  // Caption do treino quando posta no feed
  @Column({ type: 'text', nullable: true })
  caption: string | null;

  // Cheers recebidos durante live tracking
  @Column({ default: 0 })
  cheersCount: number;

  @OneToMany(() => ActivityPoint, (point) => point.activity)
  points: ActivityPoint[];

  @CreateDateColumn()
  createdAt: Date;
}
