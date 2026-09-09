// Route planner usando OSRM (Open Source Routing Machine) — público, free
// Calcula rota A→B pra foot, bike ou car

const OSRM_BASE = 'https://routing.openstreetmap.de';
let lastRequestAt = 0;
const routeCache = new Map<string, RouteResult>();

export type RouteProfile = 'foot' | 'bike' | 'driving';

export interface RouteResult {
  profile: RouteProfile;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: Array<{ latitude: number; longitude: number }>;
  /** caloria estimada por esporte */
  caloriesEstimate: {
    running: number;
    cycling: number;
    walking: number;
  };
}

// MET values (intensidade metabólica)
const MET_VALUES = {
  walking: 3.5,
  running: 9.8,
  cycling: 7.5,
};

const DEFAULT_WEIGHT = 70; // kg

function caloriesFor(met: number, durationSec: number, weightKg = DEFAULT_WEIGHT): number {
  return Math.round((met * weightKg * durationSec) / 3600);
}

export async function planRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  profile: RouteProfile = 'foot',
): Promise<RouteResult | null> {
  if (![from.latitude, from.longitude, to.latitude, to.longitude].every(Number.isFinite) ||
    Math.abs(from.latitude) > 90 || Math.abs(to.latitude) > 90 || Math.abs(from.longitude) > 180 || Math.abs(to.longitude) > 180) return null;
  const mode = profile === 'bike' ? 'bike' : profile === 'foot' ? 'foot' : 'car';
  const url = `${OSRM_BASE}/routed-${mode}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`;
  const cached = routeCache.get(url);
  if (cached) return cached;
  // FOSSGIS allows at most one request per second. No bulk/background fetching.
  if (Date.now() - lastRequestAt < 1100) return null;
  lastRequestAt = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });

    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;

    const coords: Array<{ latitude: number; longitude: number }> = (
      route.geometry?.coordinates || []
    ).map((c: [number, number]) => ({ longitude: c[0], latitude: c[1] }));

    if (coords.length < 2 || coords.length > 2000 || coords.some(c => !Number.isFinite(c.latitude) ||
      !Number.isFinite(c.longitude) || Math.abs(c.latitude) > 90 || Math.abs(c.longitude) > 180)) return null;
    if (!Number.isFinite(route.distance) || route.distance <= 0 || route.distance > 100000 ||
      !Number.isFinite(route.duration) || route.duration < 0) return null;
    const distanceMeters = route.distance;
    const durationSeconds = route.duration;

    // Para cada esporte, recalcula a duração realisticamente
    // Walking ~5 km/h, Running ~10 km/h, Cycling ~20 km/h
    const distKm = distanceMeters / 1000;
    const speedKmh = { walking: 5, running: 10, cycling: 20 };
    const durations = {
      walking: (distKm / speedKmh.walking) * 3600,
      running: (distKm / speedKmh.running) * 3600,
      cycling: (distKm / speedKmh.cycling) * 3600,
    };

    const result: RouteResult = {
      profile,
      distanceMeters,
      durationSeconds,
      coordinates: coords,
      caloriesEstimate: {
        walking: caloriesFor(MET_VALUES.walking, durations.walking),
        running: caloriesFor(MET_VALUES.running, durations.running),
        cycling: caloriesFor(MET_VALUES.cycling, durations.cycling),
      },
    };
    if (routeCache.size >= 20) routeCache.delete(routeCache.keys().next().value!);
    routeCache.set(url, result);
    return result;
  } catch { return null; }
  finally { clearTimeout(t); }
}

/** Tempo estimado por esporte. */
export function estimateTime(distanceMeters: number, sport: 'walking' | 'running' | 'cycling'): number {
  const speedKmh = { walking: 5, running: 10, cycling: 20 }[sport];
  return (distanceMeters / 1000 / speedKmh) * 3600;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}
