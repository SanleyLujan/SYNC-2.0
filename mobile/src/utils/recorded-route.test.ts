import { splitRecordedRoute, startsRecordedSegment } from './recorded-route';

it('retoma em um novo trecho após suspensão do GPS, sem unir as extremidades', () => {
  const points = [
    { timestamp: 1_000, segmentStart: true },
    { timestamp: 3_000, segmentStart: false },
    { timestamp: 63_000, segmentStart: startsRecordedSegment({ timestamp: 63_000, previousTimestamp: 3_000 }) },
    { timestamp: 65_000, segmentStart: false },
  ];
  expect(splitRecordedRoute(points).map(segment => segment.map(point => point.timestamp)))
    .toEqual([[1_000, 3_000], [63_000, 65_000]]);
});

it('preserva continuidade dos pontos entregues em segundo plano e separa pausas', () => {
  expect(startsRecordedSegment({ timestamp: 5_000, previousTimestamp: 3_000 })).toBe(false);
  expect(startsRecordedSegment({ timestamp: 5_000, previousTimestamp: 3_000, needsAnchor: true })).toBe(true);
  expect(startsRecordedSegment({ timestamp: 5_000 })).toBe(true);
  expect(splitRecordedRoute([])).toEqual([]);
});
