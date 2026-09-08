import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource, In, LessThanOrEqual } from 'typeorm';
import { Interval } from '@nestjs/schedule';
import { Challenge } from './entities/challenge.entity';
import { User } from '../users/entities/user.entity';
import { Match } from '../matching/entities/match.entity';
import { UserBlock } from '../users/entities/user-block.entity';
import { Reward } from '../gamification/reward.entity';
import { GamificationService, challengeResult } from '../gamification/gamification.service';
import { SPORT_LABELS } from '../gamification/rules';

export function validateChallenge(body: { sport: string; metric: string; target: number; expiresInDays?: number }) {
  const distanceTargets = body.sport === 'cycling' ? [1,2,3] : ['walking','running','hiking'].includes(body.sport) ? [0.5,1,1.5,2] : [];
  if (!Object.keys(SPORT_LABELS).includes(body.sport) || !Number.isFinite(body.target) ||
      !(body.metric === 'duration' ? [5,10,15].includes(body.target) : body.metric === 'distance' && distanceTargets.includes(body.target)) ||
      ![1,3,7].includes(body.expiresInDays ?? 3)) throw new BadRequestException('Escolha duração de 5, 10 ou 15 minutos, ou uma distância curta permitida, com prazo de 1, 3 ou 7 dias.');
}
@Injectable()
export class ChallengesService {
  private sweeping = false;
  private readonly logger = new Logger(ChallengesService.name);
  constructor(private readonly db: DataSource, private readonly gamification: GamificationService) {}
  async peers(userId: string) {
    const matches = await this.db.getRepository(Match).find({ where: [{ user1_id: userId }, { user2_id: userId }] });
    const blocks = await this.db.getRepository(UserBlock).find({ where: [{ blocker_id: userId }, { blocked_id: userId }] });
    const blocked = new Set(blocks.flatMap(b => [b.blocker_id,b.blocked_id]));
    const ids = matches.map(m => m.user1_id === userId ? m.user2_id : m.user1_id).filter(id => !blocked.has(id));
    if (!ids.length) return [];
    return this.db.getRepository(User).find({ where: { id: In(ids), isActive: true }, select: ['id','name','avatarUrl'], take: 100 });
  }
  async create(userId: string, body: { challengedId: string; sport: string; metric: string; target: number; expiresInDays?: number }) {
    if (userId === body.challengedId) throw new ForbiddenException('Você não pode se desafiar');
    validateChallenge(body);
    return this.db.transaction(async em => {
      for (const id of [userId,body.challengedId].sort()) {
        const found = await em.findOne(User, { where: { id, isActive: true }, ...(this.db.options.type === 'postgres' ? { lock: { mode: 'pessimistic_write' as const } } : {}) });
        if (!found) throw new NotFoundException('Conta indisponível');
      }
      const match = await em.findOne(Match, { where: [{ user1_id: userId, user2_id: body.challengedId }, { user2_id: userId, user1_id: body.challengedId }] });
      const block = await em.findOne(UserBlock, { where: [{ blocker_id: userId, blocked_id: body.challengedId }, { blocked_id: userId, blocker_id: body.challengedId }] });
      if (!match || block) throw new ForbiddenException('Desafie apenas conexões sem bloqueio.');
      for (const id of [userId,body.challengedId]) {
        const count = await em.getRepository(Challenge).createQueryBuilder('c')
          .where('(c.challenger_id = :id OR c.challenged_id = :id)', { id })
          .andWhere('c.status IN (:...states)', { states: ['pending','accepted'] })
          .andWhere('c.expiresAt > :now', { now: new Date() }).getCount();
        if (count >= 3) throw new BadRequestException('Cada pessoa pode ter até três convites/desafios ativos.');
      }
      return em.save(Challenge, em.create(Challenge, { challenger_id: userId, challenged_id: body.challengedId,
        sport: body.sport, metric: body.metric, target: body.target, ruleVersion: 1, status: 'pending',
        expiresAt: new Date(Date.now() + (body.expiresInDays ?? 3)*86400000) }));
    });
  }
  async respond(userId: string, id: string, accept: boolean) {
    if (typeof accept !== 'boolean') throw new BadRequestException('Resposta inválida');
    const c = await this.db.getRepository(Challenge).findOne({ where: { id } });
    if (!c) throw new NotFoundException('Desafio não encontrado');
    if (c.challenged_id !== userId) throw new ForbiddenException('Acesso negado');
    if (c.status !== 'pending' || !c.expiresAt || +c.expiresAt <= Date.now() || c.ruleVersion !== 1) throw new BadRequestException('Convite encerrado');
    if (accept && !(await this.peers(userId)).some(u => u.id === c.challenger_id)) throw new ForbiddenException('Conexão indisponível');
    const updated = await this.db.getRepository(Challenge).createQueryBuilder().update()
      .set({ status: accept ? 'accepted' : 'declined', acceptedAt: accept ? new Date() : null })
      .where('id = :id AND status = :status', { id, status: 'pending' }).andWhere('"expiresAt" > :now', { now: new Date() }).execute();
    if (!updated.affected) throw new BadRequestException('Convite já respondido ou expirado');
    return this.db.getRepository(Challenge).findOneByOrFail({ id });
  }
  private async settle(c: Challenge) {
    const block = await this.db.getRepository(UserBlock).findOne({where:[{blocker_id:c.challenger_id,blocked_id:c.challenged_id},{blocker_id:c.challenged_id,blocked_id:c.challenger_id}]});
    if (block) {
      await this.db.getRepository(Challenge).update({id:c.id,status:In(['pending','accepted'])},{status:'declined'});
      return;
    }
    if (c.ruleVersion !== 1 || !c.acceptedAt) {
      if (c.expiresAt && +c.expiresAt <= Date.now()) await this.db.getRepository(Challenge).update({ id: c.id, status: 'pending' }, { status: 'expired' });
      return;
    }
    await this.gamification.summary(c.challenger_id);
    await this.gamification.summary(c.challenged_id);
    const rows = await this.db.getRepository(Reward).find({ where: { user_id: In([c.challenger_id,c.challenged_id]) } });
    const result = challengeResult(c, rows);
    const status = result.challenger.completed && result.challenged.completed ? 'completed' : +new Date(c.expiresAt!) <= Date.now() ? 'expired' : 'accepted';
    await this.db.getRepository(Challenge).update({ id: c.id, status: In(['accepted','expired']) }, { status, winner_id: null });
    return result;
  }
  async list(userId: string) {
    const repo = this.db.getRepository(Challenge);
    const challenges = await repo.find({ where: [{ challenger_id: userId }, { challenged_id: userId }], order: { createdAt: 'DESC' }, take: 100 });
    const result = [];
    const blocks = await this.db.getRepository(UserBlock).find({where:[{blocker_id:userId},{blocked_id:userId}]});
    const blocked = new Set(blocks.flatMap(b => [b.blocker_id,b.blocked_id]).filter(id=>id!==userId));
    for (const c of challenges) {
      if (blocked.has(c.challenger_id) || blocked.has(c.challenged_id)) continue;
      const progress = ['pending','accepted'].includes(c.status) ? await this.settle(c) : undefined;
      const updated = await repo.findOneByOrFail({ id: c.id });
      const people = await this.db.getRepository(User).find({ where: { id: In([c.challenger_id,c.challenged_id]) }, select: ['id','name','avatarUrl'] });
      const rows = progress ? [] : await this.db.getRepository(Reward).find({ where: { user_id: In([c.challenger_id,c.challenged_id]) } });
      result.push({ ...updated, challenger: people.find(u => u.id === c.challenger_id), challenged: people.find(u => u.id === c.challenged_id),
        progress: progress || (c.acceptedAt ? challengeResult(c, rows) : null), rewardXP: 20 });
    }
    return result;
  }
  async complete(userId: string, id: string) {
    const c = await this.db.getRepository(Challenge).findOneBy({ id });
    if (!c) throw new NotFoundException('Desafio não encontrado');
    if (![c.challenger_id,c.challenged_id].includes(userId)) throw new ForbiddenException('Acesso negado');
    throw new BadRequestException('A conclusão é automática pelas atividades registradas. Não é possível declarar vitória.');
  }
  @Interval(60_000)
  async expireChallenges() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const batch = await this.db.getRepository(Challenge).find({ where: { status: In(['pending','accepted']), expiresAt: LessThanOrEqual(new Date()) }, take: 50, order: { expiresAt: 'ASC' } });
      for (const c of batch) {
        try { await this.settle(c); } catch { this.logger.warn('Desafio pendente de reconciliação; nova tentativa no próximo ciclo.'); }
      }
    } catch { this.logger.warn('Falha ao consultar expirações; será tentado novamente.'); }
    finally { this.sweeping = false; }
  }
}
