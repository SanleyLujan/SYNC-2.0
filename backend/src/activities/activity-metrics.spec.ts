import { calculateCalories, calculateElevationGain, isDistanceSport, sanitizeLaps } from './activity-metrics';

describe('activity metrics', () => {
  it('uses distance as primary measure only for route sports', () => {
    expect(isDistanceSport('running')).toBe(true);
    expect(isDistanceSport('cycling')).toBe(true);
    expect(isDistanceSport('gym')).toBe(false);
  });

  it('uses profile weight and duration in calorie estimates', () => {
    const light = calculateCalories({ sport: 'gym', durationSeconds: 3600, distanceMeters: 0, weightKg: 50, heightCm: 160 });
    const heavy = calculateCalories({ sport: 'gym', durationSeconds: 3600, distanceMeters: 0, weightKg: 100, heightCm: 190 });
    expect(light).toBe(275);
    expect(heavy).toBe(550);
  });

  it('ignores altitude noise, route gaps and impossible jumps', () => {
    const points: any[] = [
      { altitude: 100, segmentStart: true },
      { altitude: 100.4, segmentStart: false },
      { altitude: 105, segmentStart: false },
      { altitude: 200, segmentStart: false },
      { altitude: 205, segmentStart: true },
      { altitude: 208, segmentStart: false },
    ];
    expect(calculateElevationGain(points)).toBe(7.6);
  });

  it('normalizes untrusted lap values', () => {
    expect(sanitizeLaps([{ number: 99, time: -1, distance: 123.8 }])).toEqual([
      { number: 1, time: 0, distance: 124 },
    ]);
  });
});
