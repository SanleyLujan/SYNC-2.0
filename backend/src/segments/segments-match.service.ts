import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Segment } from './segment.entity';
import { SegmentEffort } from './segment-effort.entity';
import { Activity } from '../activities/entities/activity.entity';
import { competitiveRoute, matchGeometry } from '../common/utils/competitive-route';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SegmentsMatchService {
  constructor(
    @InjectRepository(Segment) private readonly segments: Repository<Segment>,
    @InjectRepository(SegmentEffort) private readonly efforts: Repository<SegmentEffort>,
    private readonly notifications: NotificationsService,
  ) {}

  async matchActivity(userId: string, activityId: string, _untrustedPoints?: unknown): Promise<number> {
    const activity = await this.segments.manager.getRepository(Activity).findOne({
      where: { id: activityId, user_id: userId }, relations: ['points'],
    });
    if (!activity || !activity.segmentsOptIn) return 0;
    const points = competitiveRoute(activity);
    if (!points.length) return 0;
    const lats = points.map(p => p.latitude), lngs = points.map(p => p.longitude);
    const candidates = await this.segments.createQueryBuilder('s')
      .where('s.sport = :sport', { sport: activity.sport }).andWhere('s.geometry IS NOT NULL')
      .andWhere('s.startLat BETWEEN :minLat AND :maxLat', { minLat: Math.min(...lats) - .001, maxLat: Math.max(...lats) + .001 })
      .andWhere('s.startLng BETWEEN :minLng AND :maxLng', { minLng: Math.min(...lngs) - .001, maxLng: Math.max(...lngs) + .001 })
      .orderBy('s.id', 'ASC').limit(100).getMany();
    let count = 0;
    for (const candidate of candidates) {
      const elapsedSec = matchGeometry(points, candidate.geometry!);
      if (elapsedSec == null) continue;
      const inserted = await this.segments.manager.transaction(async manager => {
        const repo = manager.getRepository(Segment);
        const qb = repo.createQueryBuilder('s').where('s.id = :id', { id: candidate.id });
        if (manager.connection.options.type === 'postgres') qb.setLock('pessimistic_write');
        const seg = await qb.getOne();
        if (!seg?.geometry) return false;
        const efforts = manager.getRepository(SegmentEffort);
        if (await efforts.findOneBy({ segmentId: seg.id, activityId, verified: true })) return false;
        await efforts.save(efforts.create({ segmentId: seg.id, activityId, userId, elapsedSec, verified: true }));
        // Recompute instead of trusting counters populated by legacy manual submissions.
        const valid = await efforts.createQueryBuilder('e')
          .innerJoin('e.user', 'u', 'u.isActive = :active', { active: true })
          .where('e.segmentId = :id AND e.verified = :verified', { id: seg.id, verified: true })
          .orderBy('e.elapsedSec', 'ASC').addOrderBy('e.createdAt', 'ASC').getMany();
        seg.attemptsCount = valid.length;
        seg.bestTimeSec = valid[0]?.elapsedSec ?? null; seg.bestUserId = valid[0]?.userId ?? null;
        await repo.save(seg);
        return true;
      });
      if (inserted) count++;
    }
    return count;
  }
}
