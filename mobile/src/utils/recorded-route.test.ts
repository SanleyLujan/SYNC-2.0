import { isPlausibleRecordedStep, splitRecordedRoute, startsRecordedSegment } from './recorded-route';

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

it('contabiliza deslocamentos plausíveis acima de 60m quando as leituras chegam espaçadas', () => {
  expect(isPlausibleRecordedStep(100, 8_000, 'cycling')).toBe(true);
  expect(isPlausibleRecordedStep(70, 10_000, 'running')).toBe(true);
});

it('continua descartando saltos e oscilações, usando o intervalo e a modalidade', () => {
  expect(isPlausibleRecordedStep(100, 1_000, 'cycling')).toBe(false);
  expect(isPlausibleRecordedStep(1_000, 8_000, 'cycling')).toBe(false);
  expect(isPlausibleRecordedStep(80, 10_000, 'walking')).toBe(false);
  expect(isPlausibleRecordedStep(2, 2_000, 'running')).toBe(false);
});

it('não transforma uma lacuna real ou um timestamp inválido em distância', () => {
  expect(isPlausibleRecordedStep(100, 60_000, 'cycling')).toBe(false);
  expect(isPlausibleRecordedStep(10, 0, 'cycling')).toBe(false);
  expect(isPlausibleRecordedStep(NaN, 2_000, 'cycling')).toBe(false);
});
