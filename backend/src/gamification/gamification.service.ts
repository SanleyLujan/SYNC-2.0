import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, In, LessThan } from 'typeorm';
import { Activity } from '../activities/entities/activity.entity';
import { User } from '../users/entities/user.entity';
import { Challenge } from '../challenges/entities/challenge.entity';
import { UserAchievement, ACHIEVEMENT_INFO } from '../achievements/entities/achievement.entity';
import { UserBlock } from '../users/entities/user-block.entity';
import { Reward } from './reward.entity';
import { DAILY_CAP, DAY_ZONE, Goal, dayKey, levelInfo, missions, SPORT_LABELS } from './rules';

export function eligibleActivity(a: Activity, cutoff: Date) {
  const start = new Date(a.startTime).getTime(), end = new Date(a.endTime).getTime();
  const duration = Math.min(a.duration, Math.max(0, (end-start)/1000 - (a.pausedDuration || 0)));
  if (!a.isCompleted || !Object.keys(SPORT_LABELS).includes(a.sport) || !Number.isFinite(duration) || duration < 60 || start < +cutoff || end > Date.now() || end <= start) return null;
  const distanceSports = ['walking','running','cycling','hiking'];
  let distance = distanceSports.includes(a.sport) ? Number(a.distance) : 0;
  const speedLimit = a.sport === 'cycling' ? 60 : a.sport === 'running' ? 25 : 12;
  if (!Number.isFinite(distance) || distance < 0 || distance / duration * 3.6 > speedLimit) distance = 0;
  // Distance activities without plausible server-computed movement earn nothing.
  if (distanceSports.includes(a.sport) && distance < 50) return null;
  return { start, end, duration: Math.floor(duration), distance, sport: a.sport };
}

export function goalProgress(goal: Pick<Goal, 'sport' | 'metric' | 'target'>, entries: Reward[]) {
  return Math.min(goal.target, entries.reduce((n, r) => n +
    ((goal.sport === 'any' || r.data?.sport === goal.sport) ? Number(r.data?.[goal.metric] || 0) : 0), 0));
}

export function challengeResult(c: Challenge, entries: Reward[]) {
  const target = c.target * (c.metric === 'duration' ? 60 : 1000);
  const eligible = entries.filter(r => r.source.startsWith('activity:') && r.data?.start >= +new Date(c.acceptedAt!) && r.data?.end <= +new Date(c.expiresAt!));
  const each = (id: string) => {
    const rows = eligible.filter(r => r.user_id === id && r.data.sport === c.sport).sort((a,b) => a.data.end-b.data.end);
    let progress = 0, completedAt: number | null = null;
    for (const row of rows) {
      progress += Number(row.data[c.metric] || 0);
      if (progress >= target && completedAt === null) completedAt = row.data.end;
    }
    return { progress: Math.min(target, progress)/(c.metric === 'duration' ? 60 : 1000), completed: completedAt !== null, completedAt };
  };
  return { challenger: each(c.challenger_id), challenged: each(c.challenged_id) };
}

@Injectable()
export class GamificationService {
  constructor(private readonly db: DataSource) {}

  async summary(userId: string) {
    return this.db.transaction(async em => {
      const options: any = { where: { id: userId } };
      if (this.db.options.type === 'postgres') options.lock = { mode: 'pessimistic_write' };
      const user = await em.findOne(User, options);
      if (!user) throw new NotFoundException('Conta não encontrada');
      const today = dayKey(new Date());
      const rewards = await em.find(Reward, { where: { user_id: userId } });
      const known = new Set(rewards.map(r => r.source));
      if (!known.has('baseline:v1')) {
        const old = await em.find(UserAchievement, { where: { user_id: userId, unlockedAt: LessThan(user.gamificationStartedAt || user.createdAt) } });
        const legacy = old.reduce((n,a) => n + (ACHIEVEMENT_INFO[a.type]?.xp || 0), 0);
        user.totalXP = Math.max(user.totalXP || 0, legacy);
        const baseline = await em.save(Reward, em.create(Reward, { user_id:userId, source:'baseline:v1',day:today,xp:0,data:{preservedXP:user.totalXP} }));
        rewards.push(baseline); known.add(baseline.source);
      }
      const grant = async (source: string, day: string, requested: number, data: any = null) => {
        if (known.has(source)) return;
        const spent = rewards.filter(r => r.day === day).reduce((n,r) => n+r.xp, 0);
        const xp = Math.max(0, Math.min(requested, DAILY_CAP-spent));
        const row = await em.save(Reward, em.create(Reward, { user_id: userId, source, day, xp, data }));
        rewards.push(row); known.add(source); user.totalXP = (user.totalXP || 0) + xp;
      };
      const plan = async (day: string): Promise<Goal[]> => {
        const source = `plan:${day}`;
        if (!known.has(source)) await grant(source, day, 0, missions(userId, day, user.sports || []));
        return rewards.find(r => r.source === source)!.data;
      };
      await plan(today);
      const activities = await em.getRepository(Activity).createQueryBuilder('a')
        .where('a.user_id = :id AND a.isCompleted = :done', { id: userId, done: true })
        .andWhere('a.startTime >= :since', { since: user.gamificationStartedAt || user.createdAt })
        .andWhere("NOT EXISTS (SELECT 1 FROM gamification_rewards r WHERE r.user_id = a.user_id AND r.source = CONCAT('activity:', a.id))")
        .orderBy('a.endTime', 'ASC').addOrderBy('a.id', 'ASC').take(500).getMany();
      for (const activity of activities) {
        const data = eligibleActivity(activity, user.gamificationStartedAt || user.createdAt);
        const day = dayKey(new Date(activity.endTime));
        const overlaps = data && rewards.some(r => r.source.startsWith('activity:') && r.data && r.data.start < data.end && r.data.end > data.start);
        // Persist even rejected/zero-credit events so retries cannot change the outcome.
        await grant(`activity:${activity.id}`, day, data && !overlaps ? Math.min(40, Math.floor(data.duration/60)*2) : 0, overlaps ? null : data);
        const goals = await plan(day);
        const entries = rewards.filter(r => r.day === day && r.source.startsWith('activity:'));
        for (const goal of goals) if (goalProgress(goal, entries) >= goal.target) await grant(`mission:${day}:${goal.id}`, day, goal.xp);
      }
      const challenges = await em.getRepository(Challenge).find({ where: [
        { challenger_id: userId, ruleVersion: 1, status: In(['accepted','completed','expired']) },
        { challenged_id: userId, ruleVersion: 1, status: In(['accepted','completed','expired']) },
      ] });
      for (const c of challenges) {
        if (!c.acceptedAt || !c.expiresAt) continue;
        const block = await em.findOne(UserBlock, {where:[{blocker_id:c.challenger_id,blocked_id:c.challenged_id},{blocker_id:c.challenged_id,blocked_id:c.challenger_id}]});
        if (block) continue;
        const result = challengeResult(c, rewards);
        const own = c.challenger_id === userId ? result.challenger : result.challenged;
        if (own.completedAt) await grant(`challenge:${c.id}`, dayKey(new Date(own.completedAt)), 20);
      }
      await em.update(User, userId, { totalXP: user.totalXP || 0 });
      const goals = await plan(today);
      const todayEntries = rewards.filter(r => r.day === today && r.source.startsWith('activity:'));
      return { ...levelInfo(user.totalXP), day: today, timezone: DAY_ZONE, dailyCap: DAILY_CAP,
        todayXP: rewards.filter(r => r.day === today).reduce((n,r) => n+r.xp, 0),
        missions: goals.map(g => ({ ...g, progress: goalProgress(g, todayEntries), completed: known.has(`mission:${today}:${g.id}`),
          awardedXP: rewards.find(r => r.source === `mission:${today}:${g.id}`)?.xp || 0 })) };
    });
  }
}
