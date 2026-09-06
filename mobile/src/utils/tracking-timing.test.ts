import { calculateActiveDurationSeconds } from './tracking-timing';

describe('calculateActiveDurationSeconds', () => {
  it('desconta todas as pausas concluídas', () => {
    expect(calculateActiveDurationSeconds({
      startedAt: 10_000,
      now: 80_000,
      totalPausedMs: 20_000,
    })).toBe(50);
  });

  it('mantém o relógio congelado durante uma pausa aberta', () => {
    expect(calculateActiveDurationSeconds({
      startedAt: 10_000,
      now: 80_000,
      totalPausedMs: 10_000,
      pausedAt: 60_000,
    })).toBe(40);
  });

  it('não conta tempo antes do instante real de início', () => {
    expect(calculateActiveDurationSeconds({ startedAt: 20_000, now: 10_000 })).toBe(0);
  });
});
