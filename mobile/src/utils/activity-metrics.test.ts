import { calculateLiveCalories, isDistanceActivity } from './activity-metrics';

describe('activity metrics UI', () => {
  it('classifies gym as time-based and running/cycling as distance-based', () => {
    expect(isDistanceActivity('gym')).toBe(false);
    expect(isDistanceActivity('running')).toBe(true);
    expect(isDistanceActivity('cycling')).toBe(true);
  });

  it('uses the profile weight instead of a fixed value', () => {
    const light = calculateLiveCalories({ sport: 'gym', elapsedSeconds: 1800, distanceMeters: 0, weightKg: 50, heightCm: 160 });
    const heavy = calculateLiveCalories({ sport: 'gym', elapsedSeconds: 1800, distanceMeters: 0, weightKg: 100, heightCm: 190 });
    // Cada resultado é arredondado individualmente para a exibição.
    expect(Math.abs(heavy - light * 2)).toBeLessThanOrEqual(1);
  });
});
