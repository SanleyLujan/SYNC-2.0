export type LiveRoutePoint = { latitude: number; longitude: number; timestamp: string; segmentStart?: boolean };

export function mergeLivePoints(existing: LiveRoutePoint[], incoming: LiveRoutePoint[]): LiveRoutePoint[] {
  const byTime = new Map<number, LiveRoutePoint>();
  for (const point of [...existing, ...incoming]) {
    const time = Date.parse(point.timestamp);
    if (Number.isFinite(time) && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) byTime.set(time, point);
  }
  return [...byTime.entries()].sort(([a], [b]) => a - b).map(([, point]) => point);
}
