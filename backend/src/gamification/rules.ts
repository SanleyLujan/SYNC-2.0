import { createHash } from 'crypto';

export const DAILY_CAP = 100;
export const RULE_VERSION = 'v2';
export const DAY_ZONE = 'America/Sao_Paulo';
export const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: DAY_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
export function levelInfo(totalXP: number) {
  const xp = Math.max(0, Math.floor(totalXP || 0));
  const level = Math.floor(xp / 500) + 1;
  return { totalXP: xp, level, currentLevelXP: xp % 500, nextLevelXP: 500, progress: (xp % 500) / 500, title: 'Praticante' };
}
export type Goal = { id: string; title: string; sport: string; metric: 'duration' | 'distance'; target: number; xp: number };
export const SPORT_LABELS: Record<string, string> = { walking: 'caminhada', running: 'corrida', cycling: 'ciclismo', gym: 'academia', yoga: 'yoga', swimming: 'natação', football: 'futebol', basketball: 'basquete', tennis: 'tênis', crossfit: 'CrossFit', hiking: 'trilha' };
// Duration in seconds, distance in meters. No speed or intensity objectives.
export const GOALS: Goal[] = [
  ...[5, 8, 10, 12, 15].map(n => ({ id: `any-${n}`, title: `Acumule ${n} minutos de atividade`, sport: 'any', metric: 'duration' as const, target: n * 60, xp: 20 })),
  ...['walking', 'running', 'cycling', 'gym', 'yoga', 'swimming', 'football', 'basketball', 'tennis', 'crossfit', 'hiking'].flatMap(sport =>
    [5, 10, 15].map(n => ({ id: `${sport}-${n}`, title: `${n} minutos de ${SPORT_LABELS[sport] || sport}`, sport, metric: 'duration' as const, target: n * 60, xp: 20 }))),
  ...[500, 1000, 1500, 2000].map(n => ({ id: `walk-${n}`, title: `Caminhe ${n / 1000} km no seu ritmo`, sport: 'walking', metric: 'distance' as const, target: n, xp: 20 })),
  ...[1000, 2000, 3000].map(n => ({ id: `bike-${n}`, title: `Pedale ${n / 1000} km no seu ritmo`, sport: 'cycling', metric: 'distance' as const, target: n, xp: 20 })),
];
export function missions(userId: string, day: string, sports: string[] = []): Goal[] {
  const eligible = GOALS.filter(g => g.sport === 'any' || sports.includes(g.sport));
  const ordinal = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
  const offset = (key: string) => createHash('sha256').update(`${RULE_VERSION}:${userId}:${key}`).digest().readUInt32BE(0);
  const groups = new Map<string, Goal[]>();
  for (const goal of eligible) {
    const key = `${goal.sport}:${goal.metric}`;
    groups.set(key, [...(groups.get(key) || []), goal]);
  }
  const otherKeys = [...groups.keys()].filter(key => key !== 'any:duration').sort((a,b) => offset(a)-offset(b));
  const keys = ['any:duration'];
  for (let i = 0; i < Math.min(2, otherKeys.length); i++) keys.push(otherKeys[(ordinal+i) % otherKeys.length]);
  // Rotate inside each catalogue category: no identical goal on consecutive days.
  return keys.map(key => { const pool = groups.get(key)!; return pool[(ordinal+offset(key)) % pool.length]; });
}

export function nextDayReset(now: Date): Date {
  // Locate the boundary in the configured timezone, including timezone offset changes.
  const day = dayKey(now);
  let low = now.getTime(), high = low + 27 * 3_600_000;
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (dayKey(new Date(mid)) === day) low = mid; else high = mid;
  }
  return new Date(high);
}
