import { haversineMeters } from './haversine';

export type RoutePoint = { latitude: number; longitude: number; timestamp: Date | string; segmentStart?: boolean };
export type ValidPoint = RoutePoint & { time: number };
const MAX_SPEED: Record<string, number> = { walking: 12, hiking: 12, running: 30, cycling: 65 };

/** Plausibility checks, not proof against a device that fabricates GPS. */
export function competitiveRoute(activity: { isCompleted: boolean; sport: string; startTime: Date | string;
  endTime: Date | string; duration: number; points: RoutePoint[] }, now = Date.now()): ValidPoint[] {
  if (!activity.isCompleted || !MAX_SPEED[activity.sport] || activity.duration < 60) return [];
  const start = new Date(activity.startTime).getTime(), end = new Date(activity.endTime).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end > now + 1000) return [];
  if (activity.duration > (end - start) / 1000 + 1) return [];
  if (!Array.isArray(activity.points) || activity.points.length < 3 || activity.points.length > 50000) return [];
  const points = activity.points.map(p => ({ ...p, time: new Date(p.timestamp).getTime() })).sort((a,b) => a.time - b.time);
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (![p.latitude, p.longitude, p.time].every(Number.isFinite) || Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180
      || p.time < start - 1000 || p.time > end + 1000) return [];
    if (!i) continue;
    const prev = points[i - 1], seconds = (p.time - prev.time) / 1000;
    if (seconds <= 0) return [];
    if (seconds > 30) p.segmentStart = true;
    if (p.segmentStart) continue;
    const meters = haversineMeters(prev.latitude, prev.longitude, p.latitude, p.longitude);
    // Allow small measurement noise, but not teleportation or motor-vehicle speed.
    if (meters > MAX_SPEED[activity.sport] / 3.6 * seconds + 15) return [];
    distance += meters;
  }
  if (distance < 50 || distance / activity.duration * 3.6 > MAX_SPEED[activity.sport]) return [];
  return points;
}

export function routeDistance(points: { latitude: number; longitude: number }[]) {
  return points.slice(1).reduce((sum, p, i) => sum + haversineMeters(points[i].latitude, points[i].longitude, p.latitude, p.longitude), 0);
}

/** Follow every checkpoint in order and reject shortcuts, pauses and GPS gaps. */
export function matchGeometry(points: ValidPoint[], geometry: { latitude: number; longitude: number }[]): number | null {
  if (geometry.length < 2 || geometry.length > 1000) return null;
  const distance = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) =>
    haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude);
  const nearest = (target: { latitude: number; longitude: number }, from: number) => {
    let index = -1, best = 35;
    for (let i = from; i < points.length; i++) {
      const d = distance(points[i], target);
      if (d < best) { best = d; index = i; }
    }
    return index;
  };
  const start = nearest(geometry[0], 0);
  if (start < 0) return null;
  const end = nearest(geometry[geometry.length - 1], start + 1);
  if (end < 0) return null;
  const part = points.slice(start, end + 1);
  if (part.slice(1).some(p => p.segmentStart)) return null;
  const actual = routeDistance(part), expected = routeDistance(geometry);
  if (actual < expected * 0.85 || actual > expected * 1.15 + 30) return null;
  // Ordered checkpoint coverage is linear in the track and geometry lengths.
  let checkpoint = 0;
  for (const p of part) {
    while (checkpoint < geometry.length && distance(p, geometry[checkpoint]) <= 35) checkpoint++;
  }
  if (checkpoint !== geometry.length) return null;
  const elapsed = Math.round((points[end].time - points[start].time) / 1000);
  return elapsed >= 10 ? elapsed : null;
}
