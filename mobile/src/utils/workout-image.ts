import type { Activity, ActivityPoint } from '../types';
import { isDistanceActivity } from './activity-metrics';

export type WorkoutImageBackground = 'dark' | 'light' | 'transparent';
export const WORKOUT_IMAGE_WIDTH = 1080;
export const WORKOUT_IMAGE_HEIGHT = 1350;

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
}

/** Mercator projection fitted to the card, preserving shape and GPS pause boundaries. */
export function projectWorkoutRoute(points: ActivityPoint[] = []): string {
  let interrupted = true;
  let previousLongitude: number | undefined;
  const projected = points.flatMap((point) => {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || Math.abs(point.latitude) > 85 || Math.abs(point.longitude) > 180) {
      interrupted = true;
      return [];
    }
    let longitude = point.longitude;
    // Unwrap crossings of the international date line.
    if (previousLongitude !== undefined) longitude += 360 * Math.round((previousLongitude - longitude) / 360);
    previousLongitude = longitude;
    const latitude = point.latitude * Math.PI / 180;
    const result = { x: longitude * Math.PI / 180, y: -Math.log(Math.tan(Math.PI / 4 + latitude / 2)), move: interrupted || !!point.segmentStart };
    interrupted = false;
    return [result];
  });
  if (projected.length < 2) return '';
  // Avoid spreading a long GPS history into function arguments.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of projected) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const scale = Math.min(820 / Math.max(maxX - minX, 1e-8), 420 / Math.max(maxY - minY, 1e-8));
  return projected.map((p) => `${p.move ? 'M' : 'L'}${(540 + (p.x - (minX + maxX) / 2) * scale).toFixed(2)},${(535 + (p.y - (minY + maxY) / 2) * scale).toFixed(2)}`).join(' ');
}

function durationLabel(seconds: number): string {
  const total = Math.max(0, Math.round(seconds || 0));
  const hours = Math.floor(total / 3600);
  return `${hours ? `${hours}:` : ''}${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function buildWorkoutImage(activity: Activity, options: { background: WorkoutImageBackground; includeRoute: boolean; name?: string }): string {
  const { background, includeRoute, name } = options;
  const light = background === 'light';
  const foreground = light ? '#111827' : '#FFFFFF';
  const secondary = light ? '#475569' : '#E2E8F0';
  const accent = light ? '#C2410C' : '#FF8A50';
  const text = (x: number, y: number, value: string, size: number, color = foreground, weight = 700) => {
    const attributes = `x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="${weight}"`;
    const content = escapeXml(value);
    // Draw the outline first so small letters keep their full white fill on native and web.
    const outline = background === 'transparent' ? `<text ${attributes} stroke="#111827" stroke-width="3" stroke-linejoin="round">${content}</text>` : '';
    return `${outline}<text ${attributes}>${content}</text>`;
  };
  const labels: Record<string, string> = { walking: 'Caminhada', running: 'Corrida', cycling: 'Ciclismo', swimming: 'Natação', hiking: 'Trilha', gym: 'Musculação', yoga: 'Yoga', football: 'Futebol', basketball: 'Basquete', tennis: 'Tênis', crossfit: 'CrossFit', martial_arts: 'Artes marciais', dance: 'Dança' };
  const path = includeRoute ? projectWorkoutRoute(activity.points) : '';
  const date = new Date(activity.startTime);
  const dateLabel = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
  const paceSeconds = activity.avgPace && activity.avgPace > 0 ? Math.round(activity.avgPace * 60) : 0;
  const pace = paceSeconds ? `${Math.floor(paceSeconds / 60)}:${String(paceSeconds % 60).padStart(2, '0')} /km` : '—';
  const distanceBased = isDistanceActivity(activity.sport);
  const bg = background === 'transparent' ? '' : `<rect width="1080" height="1350" fill="${light ? '#F8FAFC' : '#101827'}"/><circle cx="1040" cy="0" r="430" fill="${light ? '#FFEDD5' : '#293044'}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">${bg}
    ${text(80, 110, 'SYNC', 58, accent, 900)}
    ${text(80, 185, (name || 'Meu treino').slice(0, 32), 36)}
    ${text(80, 245, `${labels[activity.sport] || activity.sport} • ${dateLabel}`, 30, secondary, 500)}
    ${path ? `<path d="${path}" fill="none" stroke="${light ? '#FFFFFF' : '#111827'}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><path d="${path}" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` : text(80, 525, includeRoute ? 'Treino sem rota GPS' : 'Treino concluído', 42)}
    ${text(80, 825, distanceBased ? `${((activity.distance || 0) / 1000).toFixed(2)} km` : durationLabel(activity.duration), 86)}
    ${text(80, 885, distanceBased ? 'DISTÂNCIA' : 'DURAÇÃO', 25, secondary)}
    ${text(80, 1000, distanceBased ? durationLabel(activity.duration) : `${Math.round(activity.calories || 0)} kcal`, 44)}
    ${text(80, 1045, distanceBased ? 'TEMPO' : 'CALORIAS', 24, secondary)}
    ${text(585, 1000, distanceBased ? pace : `${Math.round(activity.elevationGain || 0)} m`, 44)}
    ${text(585, 1045, distanceBased ? 'RITMO MÉDIO' : 'ELEVAÇÃO', 24, secondary)}
    ${text(80, 1150, distanceBased ? `${Math.round(activity.calories || 0)} kcal` : 'Cada treino conta.', 32, secondary)}
    ${text(80, 1265, path ? 'Meu percurso • Treino concluído no Sync' : 'Treino concluído no Sync', 25, secondary)}
  </svg>`;
}
