import { currentDailySnapshot, dailyDeadline } from './daily-progress';
it('discards yesterday and other account progress', () => {
  const snapshot = { userId:'santiago', expiresAt:1000, data:{ completed:true } };
  expect(currentDailySnapshot(snapshot, 'santiago', 999)).toEqual({completed:true});
  expect(currentDailySnapshot(snapshot, 'santiago', 1000)).toBeNull();
  expect(currentDailySnapshot(snapshot, 'someone-else', 999)).toBeNull();
});
it('uses the server midnight despite an inaccurate device clock', () => {
  expect(dailyDeadline({ serverNow:'2026-09-20T02:59:00Z', resetsAt:'2026-09-20T03:00:00Z' }, 1000)).toBe(61000);
  expect(dailyDeadline({}, 1000)).toBe(1000);
});
