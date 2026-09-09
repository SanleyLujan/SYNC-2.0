import { summarizeStats, DailySportStats } from './stats-rules';
const row = (date: string, sport='running', distance=1000, duration=600, calories=80): DailySportStats =>
  ({ date,sport,count:1,distance,duration,calories });
describe('Canonical statistics', () => {
  it('keeps meters/seconds and sums stored gym calories rather than distance estimates', () => {
    const r=summarizeStats([row('2026-08-31'),row('2026-08-31','gym',0,1800,210)],'month',new Date('2026-08-31T18:00:00Z'));
    expect(r.totalDistance).toBe(1000); expect(r.totalDuration).toBe(2400); expect(r.totalCalories).toBe(290);
    expect(r.buckets[4].distance).toBe(1000); expect(r.totalActivities).toBe(2);
  });
  it('weights running pace and excludes bikes/gym from it', () => {
    const r=summarizeStats([row('2026-09-08'),row('2026-09-08','running',3000,900),row('2026-09-08','cycling',20000,3600)],'week',new Date('2026-09-08T18:00:00Z'));
    expect(r.averagePace).toBe(6.25); expect(r.averageSpeed).toBe(20);
  });
  it('uses Brasília midnight and keeps lifetime best streaks', () => {
    const r=summarizeStats([row('2020-01-01'),row('2020-01-02'),row('2026-09-07')],'week',new Date('2026-09-08T01:00:00Z'));
    expect(r.weeklyStats[6].date).toBe('2026-09-07'); expect(r.currentStreak).toBe(1); expect(r.bestStreak).toBe(2);
  });
  it('returns actual zeros for a new account', () => {
    const r=summarizeStats([],'all'); expect(r.totalActivities).toBe(0); expect(r.currentStreak).toBe(0); expect(r.averagePace).toBe(0);
  });
});
