import type { Activity, ActivityPoint } from '../types';
import { buildWorkoutImage, projectWorkoutRoute } from './workout-image';

const point = (latitude: number, longitude: number, segmentStart = false): ActivityPoint => ({ id: 'p', latitude, longitude, segmentStart, timestamp: '2026-10-05T12:00:00Z' });
const activity: Activity = { id: 'workout', user_id: 'user', sport: 'running', startTime: '2026-10-05T12:00:00Z', distance: 5230, duration: 1870, avgPace: 5.999, calories: 320, isCompleted: true, points: [point(-23.55, -46.64), point(-23.56, -46.65)] };

describe('workout image', () => {
  it('exports a transparent card with escaped user text and correctly rounded pace', () => {
    const xml = buildWorkoutImage(activity, { background: 'transparent', includeRoute: true, name: 'Ana <& "Bia"' });
    expect(xml).not.toContain('<rect');
    expect(xml).toContain('Ana &lt;&amp; &quot;Bia&quot;');
    expect(xml).toContain('5.23 km');
    expect(xml).toContain('31:10');
    expect(xml).toContain('6:00 /km');
    expect(xml).toContain('<path');
  });

  it('supports workouts without GPS and omits distance metrics for gym sessions', () => {
    const xml = buildWorkoutImage({ ...activity, sport: 'gym', points: [] }, { background: 'light', includeRoute: true });
    expect(xml).toContain('Treino sem rota GPS');
    expect(xml).toContain('DURAÇÃO');
    expect(xml).toContain('320 kcal');
    expect(xml).not.toContain('5.23 km');
    expect(xml).not.toContain('<path');
    expect(xml).toContain('<rect');
  });

  it('allows hiding the route', () => {
    expect(buildWorkoutImage(activity, { background: 'dark', includeRoute: false })).not.toContain('<path');
  });

  it('does not connect pauses or invalid GPS fixes', () => {
    const route = projectWorkoutRoute([point(0, 0), point(0, 1), point(1, 1, true), point(NaN, 0), point(1, 2), point(1, 3)]);
    expect(route.match(/M/g)).toHaveLength(3);
    expect(route).not.toMatch(/NaN|Infinity/);
  });

  it('handles stationary points and a large GPS history', () => {
    const route = projectWorkoutRoute(Array.from({ length: 150000 }, () => point(-23.55, -46.64)));
    expect(route).not.toMatch(/NaN|Infinity/);
    expect(route).toContain('M540.00,535.00');
  });

  it('preserves the short route across the date line', () => {
    const route = projectWorkoutRoute([point(0, 179.99), point(0.01, -179.99), point(0.02, -179.98)]);
    expect(route).not.toMatch(/NaN|Infinity/);
    expect(route).toContain('L');
  });
});
