import { GamificationService } from './gamification.service';
import { Reward } from './reward.entity';
import { User } from '../users/entities/user.entity';
import { Activity } from '../activities/entities/activity.entity';
import { UserAchievement } from '../achievements/entities/achievement.entity';
import { dayKey, missions } from './rules';

describe('daily mission lifecycle', () => {
  let saved: any[];
  let user: any;
  let service: GamificationService;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-20T02:59:00Z'));
    saved = [];
    user = { id:'santiago', sports:['gym', 'walking'], createdAt:new Date('2026-09-01T00:00Z'), totalXP:0 };
    const query: any = { getMany: jest.fn().mockResolvedValue([]) };
    for (const method of ['where','andWhere','orderBy','addOrderBy','take']) query[method] = () => query;
    const em = {
      findOne: async (entity: any) => entity === User ? { ...user } : null,
      find: async (entity: any) => entity === Reward ? [...saved] : entity === UserAchievement ? [] : [],
      create: (_: any, value: any) => ({ ...value }),
      save: async (_: any, value: any) => { saved.push(value); return value; },
      update: async (_: any, __: any, value: any) => { Object.assign(user, value); },
      getRepository: (entity: any) => entity === Activity ? { createQueryBuilder: () => query } : { find: async () => [] },
    };
    service = new GamificationService({ options:{type:'postgres'}, transaction:async (fn: any) => fn(em) } as any);
  });
  afterEach(() => jest.useRealTimers());
  it('starts with zero progress even if a legacy completion marker exists', async () => {
    const day = dayKey(new Date());
    saved.push({ user_id:user.id, day, source:`mission:${day}:${missions(user.id,day,user.sports)[0].id}`, xp:20 });
    const result = await service.summary(user.id);
    expect(result.missions.every(m => !m.completed && m.progress === 0 && m.awardedXP === 0)).toBe(true);
  });
  it('resets at Brasilia midnight, changes missions and preserves earned XP', async () => {
    const day = dayKey(new Date());
    saved.push({ user_id:user.id, day, source:'activity:test', xp:30, data:{ sport:'gym', duration:900, distance:0, start:+new Date('2026-09-20T02:00Z'),end:+new Date('2026-09-20T02:15Z') } });
    user.totalXP = 30;
    const before = await service.summary(user.id);
    expect(before.missions.some(m => m.completed)).toBe(true);
    const retry = await service.summary(user.id);
    expect(retry.totalXP).toBe(before.totalXP);
    jest.setSystemTime(new Date('2026-09-20T03:00:00Z'));
    const after = await service.summary(user.id);
    expect(after.day).toBe('2026-09-20');
    expect(after.todayXP).toBe(0);
    expect(after.totalXP).toBe(before.totalXP);
    expect(after.missions.every(m => !m.completed && m.progress === 0)).toBe(true);
    expect(after.missions.some(m => before.missions.some(old => old.id === m.id))).toBe(false);
    expect(after.resetsAt).toBe('2026-09-21T03:00:00.000Z');
  });
});
