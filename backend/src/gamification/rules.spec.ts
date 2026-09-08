import { missions, GOALS, levelInfo, dayKey } from './rules';
import { challengeResult, eligibleActivity, goalProgress } from './gamification.service';
describe('Gamification rules', () => {
  it('has a varied catalogue with modest targets, no intensity tasks', () => {
    expect(GOALS.length).toBeGreaterThan(30);
    for (const g of GOALS) expect(g.target).toBeLessThanOrEqual(g.metric === 'duration' ? 900 : 3000);
  });
  it('is stable for the same account/day, varies by account/day and respects sports', () => {
    expect(missions('a','2026-09-08',['gym'])).toEqual(missions('a','2026-09-08',['gym']));
    const variants = new Set(Array.from({length:20},(_,i)=>JSON.stringify(missions(`user-${i}`,'2026-09-08',['gym','walking']))));
    expect(variants.size).toBeGreaterThan(5);
    expect(missions('a','2026-09-08',['gym']).every(m=>['gym','any'].includes(m.sport))).toBe(true);
    expect(missions('a','2026-09-08',[]).some(m=>m.sport==='any')).toBe(true);
  });
  it('uses a fixed server day and canonical levels', () => {
    expect(dayKey(new Date('2026-09-08T02:59:59Z'))).toBe('2026-09-07');
    expect(dayKey(new Date('2026-09-08T03:00:00Z'))).toBe('2026-09-08');
    expect(levelInfo(500).level).toBe(2);
    expect(levelInfo(499).level).toBe(1);
  });
  it('caps active duration, rejects impossible movement, incomplete and legacy activities', () => {
    const now = Date.now();
    const a:any={isCompleted:true,sport:'gym',duration:9000,pausedDuration:120,startTime:new Date(now-600000),endTime:new Date(now-1000),distance:0};
    expect(eligibleActivity(a,new Date(now-86400000))?.duration).toBe(479);
    expect(eligibleActivity({...a,isCompleted:false},new Date(0))).toBeNull();
    expect(eligibleActivity({...a,sport:'walking',distance:200000},new Date(0))).toBeNull();
    expect(eligibleActivity(a,new Date(now))).toBeNull();
  });
  it('sums compatible activities and caps mission progress', () => {
    const entries:any=[{data:{sport:'gym',duration:400}},{data:{sport:'gym',duration:400}},{data:{sport:'cycling',duration:600}}];
    expect(goalProgress({sport:'gym',metric:'duration',target:600},entries)).toBe(600);
  });
  it('requires activity after consent and before expiry; no victory by speed', () => {
    const c:any={challenger_id:'a',challenged_id:'b',sport:'gym',metric:'duration',target:10,acceptedAt:new Date(1000),expiresAt:new Date(2000000)};
    const row=(id:string,start:number,end:number):any=>({user_id:id,source:`activity:${id}-${start}`,data:{sport:'gym',duration:600,start,end}});
    const result=challengeResult(c,[row('a',0,700000),row('a',2000,800000),row('b',2000,800000),row('b',2000001,3000000)]);
    expect(result.challenger.completed).toBe(true);
    expect(result.challenged.completed).toBe(true);
    expect(result.challenger.completedAt).toBe(800000);
  });
});
