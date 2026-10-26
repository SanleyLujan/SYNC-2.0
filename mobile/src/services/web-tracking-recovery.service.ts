export type RecordedTrackingPoint = {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
  speed?: number;
  timestamp: number;
  segmentStart: boolean;
};

export type TrackingTimingEvent = { action: 'pause' | 'resume'; occurredAt: number };

export type WebTrackingRecovery = {
  userId: string;
  activityId: string;
  sport: string;
  startedAt: number;
  totalPausedMs: number;
  pausedAt: number | null;
  pauseSource: 'manual' | 'auto' | 'confirmation' | null;
  points: RecordedTrackingPoint[];
  pendingTimingEvents: TrackingTimingEvent[];
  syncedThrough: number;
  autoPauseOn: boolean;
  plannedRoute: { latitude: number; longitude: number }[];
  targetGoal: { type: 'distance' | 'duration'; value: number } | null;
};

const RECOVERY_KEY = '@sync:web-tracking-recovery';
let recoveryEpoch = 0;

export function getWebTrackingRecoveryEpoch() { return recoveryEpoch; }

// A escrita síncrona também funciona no evento pagehide. Nenhum envio pela
// rede é necessário para preservar os pontos que o navegador já entregou.
export function saveWebTrackingRecovery(session: WebTrackingRecovery, expectedEpoch = recoveryEpoch): boolean {
  if (expectedEpoch !== recoveryEpoch) return false;
  try {
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function getWebTrackingRecovery(userId?: string): WebTrackingRecovery | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(RECOVERY_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as WebTrackingRecovery;
    if (saved.userId !== userId || !saved.activityId || !saved.sport ||
        !Number.isFinite(saved.startedAt) || !Number.isFinite(saved.totalPausedMs) ||
        !Number.isFinite(saved.syncedThrough) || !Array.isArray(saved.points) ||
        !Array.isArray(saved.pendingTimingEvents) || !Array.isArray(saved.plannedRoute) ||
        (saved.pausedAt !== null && !Number.isFinite(saved.pausedAt))) return null;
    if (!saved.points.every(point => Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
      Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 &&
      Number.isFinite(point.timestamp) && point.timestamp >= saved.startedAt)) return null;
    if (!saved.pendingTimingEvents.every(event => ['pause', 'resume'].includes(event.action) &&
      Number.isFinite(event.occurredAt) && event.occurredAt >= saved.startedAt)) return null;
    return saved;
  } catch {
    return null;
  }
}

export function clearWebTrackingRecovery() {
  recoveryEpoch++;
  try { localStorage.removeItem(RECOVERY_KEY); } catch {}
}
