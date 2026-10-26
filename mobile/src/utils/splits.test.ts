import { computeSplits } from './splits';

it('não transforma uma lacuna do GPS em quilômetros ou tempo de split', () => {
  const start = Date.parse('2026-10-26T12:00:00Z');
  const points = [
    { latitude: 0, longitude: 0, timestamp: start, segmentStart: true },
    { latitude: 0, longitude: 0.001, timestamp: start + 10_000 },
    { latitude: 0, longitude: 0.05, timestamp: start + 610_000, segmentStart: true },
    { latitude: 0, longitude: 0.051, timestamp: start + 620_000 },
  ];
  const splits = computeSplits(points);
  expect(splits).toHaveLength(1);
  expect(splits[0].distanceKm).toBeCloseTo(0.2224, 3);
  expect(splits[0].durationSec).toBe(20);
});
