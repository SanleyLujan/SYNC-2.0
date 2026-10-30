export const GPS_GAP_MS = 15_000;

const MAX_TRACKING_SPEED: Record<string, number> = {
  walking: 6, running: 12, cycling: 25, hiking: 5, swimming: 3,
};

/** Valida deslocamentos de um trecho contínuo pelo intervalo real entre fixes. */
export function isPlausibleRecordedStep(distanceMeters: number, elapsedMs: number, sport: string): boolean {
  if (!Number.isFinite(distanceMeters) || !Number.isFinite(elapsedMs) ||
      distanceMeters < 2.5 || elapsedMs <= 0 || elapsedMs > GPS_GAP_MS) return false;
  // Preserva o filtro anterior em amostras curtas, sem rejeitar um deslocamento
  // legítimo só porque o navegador demorou mais para entregar o próximo fix.
  const maximumDistance = Math.max(60, (MAX_TRACKING_SPEED[sport] || 12) * elapsedMs / 1000);
  return distanceMeters <= maximumDistance;
}

export function startsRecordedSegment(input: {
  timestamp: number;
  previousTimestamp?: number;
  needsAnchor?: boolean;
}) {
  return Boolean(input.needsAnchor) || input.previousTimestamp == null ||
    input.timestamp - input.previousTimestamp > GPS_GAP_MS;
}

export function splitRecordedRoute<T extends { segmentStart?: boolean }>(points: T[]): T[][] {
  const segments: T[][] = [];
  for (const point of points) {
    if (point.segmentStart || segments.length === 0) segments.push([]);
    segments[segments.length - 1].push(point);
  }
  return segments;
}
