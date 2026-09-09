import { dayKey } from '../gamification/rules';

export type StatsPeriod = 'all' | 'week' | 'month' | 'year';
export interface DailySportStats {
  date: string; sport: string; count: number; distance: number; duration: number; calories: number;
}
export const shiftDay = (day: string, offset: number) =>
  new Date(Date.parse(day + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);

export function summarizeStats(rows: DailySportStats[], period: StatsPeriod, now = new Date()) {
  const today = dayKey(now);
  const weekStart = shiftDay(today, -6);
  const start = period === 'week' ? weekStart : period === 'month' ? today.slice(0, 7) + '-01'
    : period === 'year' ? today.slice(0, 4) + '-01-01' : '0000-01-01';
  const history = rows.filter(r => r.date <= today);
  const selected = history.filter(r => r.date >= start);
  const sum = (list: DailySportStats[], field: 'count' | 'distance' | 'duration' | 'calories') =>
    list.reduce((total, r) => total + Math.max(0, Number(r[field]) || 0), 0);
  const running = selected.filter(r => r.sport === 'running' && r.distance > 0 && r.duration > 0);
  const cycling = selected.filter(r => r.sport === 'cycling' && r.distance > 0 && r.duration > 0);
  const dates = [...new Set(history.filter(r => r.count > 0).map(r => r.date))].sort();
  let bestStreak = 0, streak = 0;
  dates.forEach((date, i) => {
    streak = i && shiftDay(dates[i - 1], 1) === date ? streak + 1 : 1;
    bestStreak = Math.max(bestStreak, streak);
  });
  const last = dates[dates.length - 1];
  const currentStreak = last === today || last === shiftDay(today, -1) ? streak : 0;
  const sportBreakdown = [...new Set(selected.map(r => r.sport))].map(sport => {
    const group = selected.filter(r => r.sport === sport);
    return { sport, count: sum(group, 'count'), totalDistance: sum(group, 'distance'),
      totalDuration: sum(group, 'duration'), calories: sum(group, 'calories') };
  });
  const weeklyStats = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(weekStart, i), group = history.filter(r => r.date === date);
    return { date, distance: sum(group, 'distance'), duration: sum(group, 'duration'), count: sum(group, 'count') };
  });
  const monthlyStats = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 12 + i, 1)).toISOString().slice(0, 7);
    const group = history.filter(r => r.date.startsWith(month));
    return { month, distance: sum(group, 'distance'), duration: sum(group, 'duration'), count: sum(group, 'count') };
  });
  const buckets = period === 'year' ? Array.from({ length: 12 }, (_, i) => {
    const month = `${today.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
    return { label: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][i],
      distance: sum(selected.filter(r => r.date.startsWith(month)), 'distance') };
  }) : period === 'month' ? Array.from({ length: 5 }, (_, i) => ({
    label: `S${i + 1}`, distance: sum(selected.filter(r => Math.floor((Number(r.date.slice(8)) - 1) / 7) === i), 'distance'),
  })) : weeklyStats.map(r => ({ label: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(r.date + 'T12:00:00Z').getUTCDay()], distance: r.distance }));
  return {
    schemaVersion: 2, units: { distance: 'm', duration: 's', pace: 'min/km', speed: 'km/h', calories: 'kcal' },
    timezone: 'America/Sao_Paulo', period, totalActivities: sum(selected, 'count'),
    totalDistance: sum(selected, 'distance'), totalDuration: sum(selected, 'duration'), totalCalories: sum(selected, 'calories'),
    averagePace: sum(running, 'distance') ? sum(running, 'duration') / 60 / (sum(running, 'distance') / 1000) : 0,
    averageSpeed: sum(cycling, 'duration') ? sum(cycling, 'distance') / sum(cycling, 'duration') * 3.6 : 0,
    paceSport: 'running', speedSport: 'cycling', currentStreak, bestStreak, sportBreakdown, weeklyStats, monthlyStats, buckets,
    weeklyDistanceKm: sum(history.filter(r => r.date >= weekStart), 'distance') / 1000,
  };
}
