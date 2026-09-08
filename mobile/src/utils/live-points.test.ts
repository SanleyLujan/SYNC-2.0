import { mergeLivePoints } from './live-points';

it('reconcilia REST e socket após reconexão, sem duplicar ou apagar pontos recentes', () => {
  const point = (second: number) => ({ latitude: 0, longitude: 0, timestamp: new Date(second*1000).toISOString() });
  expect(mergeLivePoints([point(3),point(2)], [point(1),point(2)])).toEqual([point(1),point(2),point(3)]);
});
