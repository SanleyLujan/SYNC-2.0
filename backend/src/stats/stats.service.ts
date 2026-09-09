import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { Match } from '../matching/entities/match.entity';
import { Event } from '../events/entities/event.entity';
import { Message } from '../chat/entities/message.entity';
import { DailySportStats, StatsPeriod, summarizeStats } from './stats-rules';

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Activity) private readonly activityRepository: Repository<Activity>,
    @InjectRepository(Match) private readonly matchRepository: Repository<Match>,
    @InjectRepository(Event) private readonly eventRepository: Repository<Event>,
    @InjectRepository(Message) private readonly messageRepository: Repository<Message>,
  ) {}

  async getUserStats(userId: string, period: StatsPeriod = 'all') {
    const pg = this.activityRepository.manager.connection.options.type === 'postgres';
    const day = pg ? `TO_CHAR(a.startTime AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD')`
      : `strftime('%Y-%m-%d', a.startTime, '-3 hours')`;
    const rows = await this.activityRepository.createQueryBuilder('a')
      .select(day, 'date').addSelect('a.sport', 'sport').addSelect('COUNT(a.id)', 'count')
      .addSelect('COALESCE(SUM(a.distance), 0)', 'distance').addSelect('COALESCE(SUM(a.duration), 0)', 'duration')
      .addSelect('COALESCE(SUM(a.calories), 0)', 'calories')
      .where('a.user_id = :userId', { userId }).andWhere('a.isCompleted = :completed', { completed: true })
      .andWhere('a.startTime <= :now', { now: new Date() })
      .groupBy(day).addGroupBy('a.sport').getRawMany<DailySportStats>();
    const [longest, totalMatches, totalEvents, totalMessagesSent] = await Promise.all([
      this.activityRepository.findOne({ where: { user_id: userId, isCompleted: true }, order: { distance: 'DESC' },
        select: ['id', 'sport', 'distance', 'duration', 'startTime'] }),
      this.matchRepository.createQueryBuilder('m').where('m.user1_id = :userId OR m.user2_id = :userId', { userId }).getCount(),
      this.eventRepository.count({ where: { creator_id: userId } }),
      this.messageRepository.count({ where: { sender_id: userId } }),
    ]);
    return { ...summarizeStats(rows, period), totalMatches, totalEvents, totalMessagesSent,
      longestActivity: longest ? { id: longest.id, sport: longest.sport, distance: longest.distance,
        duration: longest.duration, date: longest.startTime } : null };
  }

  async getWeeklySummary(userId: string) { return (await this.getUserStats(userId, 'week')).weeklyStats; }
}
