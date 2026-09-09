import { Activity } from '../activities/entities/activity.entity';
import { competitiveRoute } from '../common/utils/competitive-route';
import { dayKey } from '../gamification/rules';
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { TerritoryCell } from './entities/territory-cell.entity';
import { User } from '../users/entities/user.entity';

// Tamanho da célula em graus (~130m no equador). Ajustável.
const CELL_DEG = 0.0012;

/** Cor determinística (hsl) a partir do id do usuário — estável entre sessões. */
function colorForUser(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360;
  }
  return `hsl(${h}, 75%, 52%)`;
}

function cellIndex(value: number): number {
  return Math.round(value / CELL_DEG);
}

@Injectable()
export class TerritoryService {
  constructor(
    @InjectRepository(TerritoryCell)
    private readonly cellRepo: Repository<TerritoryCell>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /** Only a completed activity owned by the authenticated athlete can claim cells. */
  async claim(userId: string, activityId: string) {
    if (typeof activityId !== 'string' || !/^[0-9a-f-]{36}$/i.test(activityId)) {
      throw new BadRequestException('Informe uma atividade concluída; captura manual não é permitida');
    }
    const result = await this.cellRepo.manager.transaction(async manager => {
      // A short shared lock also serializes overlapping claims by different athletes.
      if (manager.connection.options.type === 'postgres') await manager.query('SELECT pg_advisory_xact_lock(28092026)');
      const activities = manager.getRepository(Activity);
      const activity = await activities.findOne({ where: { id: activityId, user_id: userId }, relations: ['points'] });
      if (!activity) throw new BadRequestException('Atividade não encontrada');
      if (!activity.territoryOptIn) return { claimed: 0, stolen: 0 };
      if (activity.territoryProcessed) return { claimed: 0, stolen: 0 };
      const points = competitiveRoute(activity);
      const month = dayKey(new Date()).slice(0, 7);
      if (!points.length || dayKey(new Date(activity.endTime)).slice(0, 7) !== month) {
        return { claimed: 0, stolen: 0 };
      }
      const profile = await manager.getRepository(User).findOneBy({ id: userId, isActive: true });
      if (!profile) throw new BadRequestException('Conta indisponível');
      const repo = manager.getRepository(TerritoryCell);
      const visits = new Map<string, { lat: number; lng: number; time: number }>();
      for (const p of points) {
        const li = cellIndex(p.latitude), gi = cellIndex(p.longitude);
        const id = month + ':' + li + '_' + gi;
        visits.set(id, { lat: li * CELL_DEG, lng: gi * CELL_DEG, time: p.time });
      }
      const limited = [...visits].slice(0, 2000);
      const existing = await repo.findBy({ cellId: In(limited.map(([id]) => id)) });
      const previous = new Map(existing.map(c => [c.cellId, c]));
      const updates: TerritoryCell[] = [];
      let claimed = 0, stolen = 0;
      for (const [cellId, visit] of limited) {
        const old = previous.get(cellId);
        if (old && Number(old.capturedAt) >= visit.time) continue;
        if (!old || old.ownerId !== userId) { claimed++; if (old) stolen++; }
        updates.push(repo.create({ ...old, cellId, ownerId: userId, ownerName: profile.name,
          ownerColor: colorForUser(userId), lat: visit.lat, lng: visit.lng, capturedAt: String(visit.time),
          claimCount: (old?.claimCount || 0) + (old?.ownerId === userId ? 0 : 1) }));
      }
      for (let i = 0; i < updates.length; i += 200) await repo.upsert(updates.slice(i, i + 200), ['cellId']);
      await activities.update(activity.id, { territoryProcessed: true });
      return { claimed, stolen };
    });
    return { ...result, totalOwned: (await this.myStats(userId)).cells };
  }

  /** Células dentro de uma bounding box (viewport do mapa). */
  async cellsInBox(
    minLat: number,
    minLng: number,
    maxLat: number,
    maxLng: number,
  ): Promise<TerritoryCell[]> {
    if (![minLat, minLng, maxLat, maxLng].every((n) => typeof n === 'number' && isFinite(n))) {
      return [];
    }
    return this.cellRepo.createQueryBuilder('c')
      .innerJoin(User, 'u', 'CAST(u.id AS text) = c.ownerId AND u.isActive = :active', { active: true })
      .where('c.cellId LIKE :season', { season: dayKey(new Date()).slice(0, 7) + ':%' })
      .andWhere('c.lat BETWEEN :minLat AND :maxLat', { minLat: Math.min(minLat,maxLat), maxLat: Math.max(minLat,maxLat) })
      .andWhere('c.lng BETWEEN :minLng AND :maxLng', { minLng: Math.min(minLng,maxLng), maxLng: Math.max(minLng,maxLng) })
      .limit(3000).getMany();
  }

  /** Top usuários por número de células conquistadas. */
  async leaderboard(limit = 10) {
    const rows = await this.cellRepo
      .createQueryBuilder('c')
      .select('c.ownerId', 'ownerId')
      .addSelect('c.ownerName', 'ownerName')
      .addSelect('c.ownerColor', 'ownerColor')
      .addSelect('COUNT(*)', 'cells')
      .innerJoin(User, 'u', 'CAST(u.id AS text) = c.ownerId AND u.isActive = :active', { active: true })
      .where('c.cellId LIKE :season', { season: dayKey(new Date()).slice(0, 7) + ':%' })
      .groupBy('c.ownerId')
      .addGroupBy('c.ownerName')
      .addGroupBy('c.ownerColor')
      .orderBy('cells', 'DESC')
      .limit(limit)
      .getRawMany<{ ownerId: string; ownerName: string; ownerColor: string; cells: string }>();

    return rows.map((r, i) => ({
      position: i + 1,
      userId: r.ownerId,
      name: r.ownerName,
      color: r.ownerColor,
      cells: parseInt(r.cells, 10),
    }));
  }

  async myStats(userId: string) {
    const cells = await this.cellRepo.count({ where: { ownerId: userId, cellId: Like(dayKey(new Date()).slice(0, 7) + ':%') } });
    // posição no ranking
    const all = await this.leaderboard(1000);
    const me = all.find((u) => u.userId === userId);
    return { cells, position: me?.position ?? null, color: colorForUser(userId) };
  }
}
