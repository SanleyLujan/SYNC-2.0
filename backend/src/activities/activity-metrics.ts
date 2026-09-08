import { ActivityPoint } from './entities/activity-point.entity';

export const DISTANCE_SPORTS = new Set(['walking', 'running', 'cycling', 'swimming', 'hiking']);

export function isDistanceSport(sport: string): boolean {
  return DISTANCE_SPORTS.has(sport);
}

function inferredWeightKg(weightKg?: number | null, heightCm?: number | null): number {
  if (weightKg != null && Number.isFinite(weightKg) && weightKg >= 30 && weightKg <= 300) {
    return weightKg;
  }
  // Altura só é usada para uma estimativa conservadora quando o peso não foi
  // informado. A fórmula MET correta depende principalmente de peso e tempo.
  if (heightCm != null && Number.isFinite(heightCm) && heightCm >= 120 && heightCm <= 230) {
    const heightM = heightCm / 100;
    return Math.max(45, Math.min(120, 22 * heightM * heightM));
  }
  return 70;
}

export function estimateMet(sport: string, speedKmh: number): number {
  switch (sport) {
    case 'running':
      if (speedKmh >= 12) return 12.5;
      if (speedKmh >= 10) return 10;
      if (speedKmh >= 8) return 8.3;
      return 6;
    case 'cycling':
      if (speedKmh >= 25) return 10;
      if (speedKmh >= 19) return 8;
      return 6.8;
    case 'swimming': return 8;
    case 'hiking': return 6;
    case 'gym': return 5.5;
    case 'crossfit': return 8;
    case 'football': return 7;
    case 'basketball': return 6.5;
    case 'tennis': return 7.3;
    case 'martial_arts': return 8;
    case 'dance': return 5;
    case 'yoga': return 3;
    default: return 5;
  }
}

export function calculateCalories(input: {
  sport: string;
  durationSeconds: number;
  distanceMeters: number;
  weightKg?: number | null;
  heightCm?: number | null;
}): number {
  if (input.durationSeconds <= 0) return 0;
  const hours = input.durationSeconds / 3600;
  const speedKmh = hours > 0 ? (input.distanceMeters / 1000) / hours : 0;
  const weightKg = inferredWeightKg(input.weightKg, input.heightCm);
  return Math.max(0, Math.round(estimateMet(input.sport, speedKmh) * weightKg * hours));
}

export function calculateElevationGain(points: ActivityPoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].segmentStart) continue;
    const before = points[i - 1].altitude;
    const after = points[i].altitude;
    if (!Number.isFinite(before) || !Number.isFinite(after)) continue;
    const delta = Number(after) - Number(before);
    // Ignora ruído submétrico e saltos impossíveis de GPS.
    if (delta >= 0.8 && delta <= 30) gain += delta;
  }
  return Math.round(gain * 10) / 10;
}

export function sanitizeLaps(laps?: Array<{ number: number; time: number; distance: number }>) {
  if (!Array.isArray(laps)) return null;
  return laps.slice(0, 100).map((lap, index) => ({
    number: index + 1,
    time: Math.max(0, Math.min(604_800, Math.floor(Number(lap?.time) || 0))),
    distance: Math.max(0, Math.min(1_000_000, Math.round(Number(lap?.distance) || 0))),
  }));
}
