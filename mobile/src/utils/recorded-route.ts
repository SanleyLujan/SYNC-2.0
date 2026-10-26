export const GPS_GAP_MS = 15_000;

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
