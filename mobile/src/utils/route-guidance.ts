export type Coordinate = { latitude: number; longitude: number };
/** Projection on the planned polyline; distances are estimates, not turn-by-turn navigation. */
export function routeGuidance(route: Coordinate[], position?: Coordinate) {
  if (!position || route.length < 2) return null;
  const scale = Math.cos(position.latitude * Math.PI / 180);
  const xy = (p: Coordinate) => ({ x: (p.longitude - position.longitude) * 111320 * scale,
    y: (p.latitude - position.latitude) * 111320 });
  let closest = Infinity, along = 0, total = 0;
  for (let i = 1; i < route.length; i++) {
    const a = xy(route[i - 1]), b = xy(route[i]);
    const dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy;
    const length = Math.sqrt(squared), t = squared ? Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / squared)) : 0;
    const separation = Math.hypot(a.x + t * dx, a.y + t * dy);
    if (separation < closest) { closest = separation; along = total + t * length; }
    total += length;
  }
  const end = xy(route[route.length - 1]);
  return { offRoute: closest > 60, distanceFromRoute: Math.round(closest), remainingMeters: Math.max(0, Math.round(total - along)),
    arrived: Math.hypot(end.x, end.y) < 30 && total - along < 50 };
}
