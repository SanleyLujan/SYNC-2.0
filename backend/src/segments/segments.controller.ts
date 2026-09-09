import { Activity } from '../activities/entities/activity.entity';
import { competitiveRoute, routeDistance } from '../common/utils/competitive-route';
import { SegmentsMatchService } from './segments-match.service';
import { Controller, Get, Post, Body, Query, UseGuards, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { Segment } from './segment.entity';
import { SegmentEffort } from './segment-effort.entity';
import { Follow } from '../follows/follow.entity';
import { sanitizeText } from '../common/security/sanitize.util';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';

@ApiTags('Segments')
@Controller('api/segments')
export class SegmentsController {
  constructor(
    @InjectRepository(Segment) private readonly repo: Repository<Segment>,
    @InjectRepository(SegmentEffort) private readonly efforts: Repository<SegmentEffort>,
    @InjectRepository(Follow) private readonly follows: Repository<Follow>,
    private readonly notifications: NotificationsService,
    private readonly matcher: SegmentsMatchService,
  ) {}

  @Get('me/koms')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Quantos KOM/QOM o atleta detém' })
  async myKoms(@CurrentUser() user: User) {
    const count = await this.repo.count({ where: { bestUserId: user.id, geometry: Not(IsNull()) } });
    return { count };
  }

  @Get(':id/my-efforts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seus tempos neste segmento (evolução cronológica)' })
  async myEfforts(@CurrentUser() user: User, @Param('id') id: string) {
    const rows = await this.efforts.find({
      where: { segmentId: id, userId: user.id, verified: true },
      order: { createdAt: 'ASC' },
      take: 100,
    });
    if (rows.length === 0) {
      return { efforts: [], bestSec: null, lastSec: null, count: 0 };
    }
    const times = rows.map((e) => e.elapsedSec);
    return {
      count: rows.length,
      bestSec: Math.min(...times),
      lastSec: times[times.length - 1],
      efforts: rows.map((e) => ({ elapsedSec: e.elapsedSec, createdAt: e.createdAt })),
    };
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Segments próximos (raio em km)' })
  async nearby(@Query('lat') lat: string, @Query('lng') lng: string, @Query('radiusKm') radiusKm?: string) {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    // Cap radius: mínimo 0.5 km, máximo 50 km (evita bounding-box gigante)
    const r = Math.max(0.5, Math.min(50, parseFloat(radiusKm || '10')));
    if (!isFinite(r) || !isFinite(latN) || !isFinite(lngN)) return [];
    // Validação de coordenadas GPS
    if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) return [];
    const dLat = r / 111;
    const dLng = r / (111 * Math.cos((latN * Math.PI) / 180));
    const segments = await this.repo
      .createQueryBuilder('s')
      .where('s.startLat BETWEEN :latMin AND :latMax', { latMin: latN - dLat, latMax: latN + dLat })
      .andWhere('s.startLng BETWEEN :lngMin AND :lngMax', { lngMin: lngN - dLng, lngMax: lngN + dLng })
      .andWhere('s.geometry IS NOT NULL')
      .orderBy('s.attemptsCount', 'DESC')
      .limit(50)
      .getMany();
    // Não expõe o criador neste endpoint (lista pública)
    return segments.map(({ creator: _creator, ...s }) => s);
  }

  @Get('trending')
  @ApiOperation({ summary: 'Segmentos em alta (mais tentativas nos últimos 14 dias)' })
  async trending() {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await this.efforts
      .createQueryBuilder('e')
      .select('e.segment_id', 'segmentId')
      .addSelect('COUNT(e.id)', 'recentCount')
      .where('e.createdAt >= :since', { since }).andWhere('e.verified = :verified', { verified: true })
      .groupBy('e.segment_id')
      .orderBy('"recentCount"', 'DESC')
      .limit(10)
      .getRawMany<{ segmentId: string; recentCount: string }>();

    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.segmentId);
    const segments = await this.repo.find({ where: { id: In(ids) } });
    const byId = new Map(segments.map((s) => [s.id, s]));
    return rows
      .map((r) => {
        const s = byId.get(r.segmentId);
        if (!s) return null;
        const { creator: _c, ...rest } = s as any;
        return { ...rest, recentCount: parseInt(r.recentCount, 10) };
      })
      .filter(Boolean);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe de um segment' })
  async detail(@Param('id') id: string) {
    const segment = await this.repo.findOne({ where: { id }, relations: ['creator'] });
    if (!segment) return null;
    // Projeta apenas campos públicos do criador (sem email, lat, long)
    const safeCreator = segment.creator
      ? {
          id: segment.creator.id,
          name: segment.creator.name,
          avatarUrl: (segment.creator as any).avatarUrl,
          city: segment.creator.showLocation ? segment.creator.city : null,
          level: (segment.creator as any).level,
        }
      : null;
    return { ...segment, creator: safeCreator, ...(!segment.geometry ? { bestTimeSec: null, bestUserId: null, attemptsCount: 0 } : {}) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar segment' })
  async create(
    @CurrentUser() user: User,
    @Body() body: { name: string; activityId: string; startIndex?: number; endIndex?: number },
  ) {
    if (!body || typeof body.activityId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.activityId)) {
      throw new BadRequestException('Crie o segmento a partir de um treino concluído com GPS');
    }
    const activity = await this.repo.manager.getRepository(Activity).findOne({
      where: { id: body.activityId, user_id: user.id }, relations: ['points'],
    });
    const points = activity ? competitiveRoute(activity) : [];
    if (!points.length) throw new BadRequestException('Este treino não tem um percurso GPS elegível');
    const start = body.startIndex ?? 0, end = body.endIndex ?? points.length - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end >= points.length || end <= start) {
      throw new BadRequestException('Trecho inválido');
    }
    const part = points.slice(start, end + 1);
    const distance = routeDistance(part);
    if (part.slice(1).some(p => p.segmentStart) || distance < 100 || distance > 5000) {
      throw new BadRequestException('Use um trecho contínuo de 100 m a 5 km, sem pausas ou falhas de GPS');
    }
    const name = sanitizeText(body.name, 100);
    if (!name) throw new BadRequestException('Informe um nome');
    const geometry = part.filter((_, i) => i % Math.ceil(part.length / 999) === 0 || i === part.length - 1)
      .map(p => ({ latitude: p.latitude, longitude: p.longitude }));
    const segment = await this.repo.save(this.repo.create({
      name, description: null, city: user.city || null, distanceMeters: distance, sport: activity!.sport,
      startLat: part[0].latitude, startLng: part[0].longitude, endLat: part[part.length - 1].latitude,
      endLng: part[part.length - 1].longitude, geometry, createdBy: user.id,
    }));
    await this.repo.manager.getRepository(Activity).update(activity!.id, { segmentsOptIn: true });
    await this.matcher.matchActivity(user.id, activity!.id);
    return this.repo.findOneBy({ id: segment.id });
  }

  @Get(':id/leaderboard')
  @ApiOperation({ summary: 'Leaderboard global do segment (melhor tempo por atleta)' })
  async leaderboard(@Param('id') id: string) {
    return this.buildLeaderboard(id);
  }

  @Get(':id/leaderboard/friends')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leaderboard restrito a quem você segue (+ você)' })
  async friendsLeaderboard(@CurrentUser() user: User, @Param('id') id: string) {
    const follows = await this.follows.find({
      where: { follower_id: user.id },
      select: ['following_id'],
    });
    const allowed = [user.id, ...follows.map((f) => f.following_id)];
    return this.buildLeaderboard(id, allowed, user.id);
  }

  /** Monta o ranking; se restrictUserIds vier, filtra só esses atletas. */
  private async buildLeaderboard(id: string, restrictUserIds?: string[], viewerId?: string) {
    if (restrictUserIds && restrictUserIds.length === 0) return [];
    const qb = this.efforts
      .createQueryBuilder('e')
      .select('e.user_id', 'userId')
      .addSelect('MIN(e.elapsed_sec)', 'bestSec')
      .addSelect('COUNT(e.id)', 'tries')
      .innerJoin('e.user', 'u', 'u.isActive = :active', { active: true })
      .where('e.segment_id = :id', { id }).andWhere('e.verified = :verified', { verified: true });
    if (viewerId) qb.andWhere('NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = :viewer AND b.blocked_id = u.id) OR (b.blocked_id = :viewer AND b.blocker_id = u.id))', { viewer: viewerId });
    if (restrictUserIds) {
      qb.andWhere('e.user_id IN (:...allowed)', { allowed: restrictUserIds });
    }
    const rows = await qb
      .groupBy('e.user_id')
      .orderBy('"bestSec"', 'ASC')
      .limit(50)
      .getRawMany<{ userId: string; bestSec: string; tries: string }>();

    if (rows.length === 0) return [];

    // Carrega só os campos públicos dos atletas do ranking
    const ids = rows.map((r) => r.userId);
    const users = await this.repo.manager
      .getRepository(User)
      .createQueryBuilder('u')
      .select(['u.id', 'u.name', 'u.avatarUrl', 'u.city', 'u.level', 'u.showLocation'])
      .where('u.id IN (:...ids)', { ids })
      .getMany();
    const byId = new Map(users.map((u) => [u.id, u]));

    const globalBest = await this.efforts.createQueryBuilder('e').innerJoin('e.user', 'u', 'u.isActive = :active', { active: true })
      .where('e.segmentId = :id AND e.verified = :verified', { id, verified: true }).orderBy('e.elapsedSec', 'ASC').addOrderBy('e.createdAt', 'ASC').getOne();
    return rows.map((r, i) => {
      const u = byId.get(r.userId);
      return {
        rank: i + 1,
        userId: r.userId,
        name: u?.name || 'Atleta',
        avatarUrl: (u as any)?.avatarUrl || null,
        city: u?.showLocation ? u.city : null,
        level: (u as any)?.level || null,
        elapsedSec: parseInt(r.bestSec, 10),
        tries: parseInt(r.tries, 10),
        isKOM: r.userId === globalBest?.userId,
      };
    });
  }

  @Post(':id/effort')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar um tempo (effort) no segment' })
  async recordEffort(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: { elapsedSec: number; activityId?: string },
  ) {
    // Keep the old endpoint explicit for outdated clients; manual times never enter the ranking.
    throw new BadRequestException('Tempos manuais desativados. Complete um treino GPS no mesmo esporte para registrar automaticamente.');
  }
}
