const DISTANCE_SPORTS = new Set(['running', 'cycling', 'swimming', 'hiking']);

export function isDistanceActivity(sport: string): boolean {
  return DISTANCE_SPORTS.has(sport);
}

function weightForEstimate(weightKg?: number, heightCm?: number): number {
  if (weightKg && Number.isFinite(weightKg) && weightKg >= 30 && weightKg <= 300) return weightKg;
  if (heightCm && Number.isFinite(heightCm) && heightCm >= 120 && heightCm <= 230) {
    return Math.max(45, Math.min(120, 22 * (heightCm / 100) ** 2));
  }
  return 70;
}

function metFor(sport: string, speedKmh: number): number {
  if (sport === 'running') return speedKmh >= 12 ? 12.5 : speedKmh >= 10 ? 10 : speedKmh >= 8 ? 8.3 : 6;
  if (sport === 'cycling') return speedKmh >= 25 ? 10 : speedKmh >= 19 ? 8 : 6.8;
  return ({ swimming: 8, hiking: 6, gym: 5.5, crossfit: 8, football: 7, basketball: 6.5, tennis: 7.3, martial_arts: 8, dance: 5, yoga: 3 } as Record<string, number>)[sport] || 5;
}

export function calculateLiveCalories(input: {
  sport: string;
  elapsedSeconds: number;
  distanceMeters: number;
  weightKg?: number;
  heightCm?: number;
}): number {
  if (input.elapsedSeconds <= 0) return 0;
  const hours = input.elapsedSeconds / 3600;
  const speedKmh = (input.distanceMeters / 1000) / hours;
  return Math.max(0, Math.round(metFor(input.sport, speedKmh) * weightForEstimate(input.weightKg, input.heightCm) * hours));
}
