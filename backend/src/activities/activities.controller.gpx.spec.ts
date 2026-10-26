import { ActivitiesController } from './activities.controller';

it('exporta lacunas do percurso como segmentos GPX separados', async () => {
  const startTime = '2026-10-26T12:00:00.000Z';
  const getActivityDetail = jest.fn().mockResolvedValue({ sport: 'running', startTime, points: [
    { latitude: 0, longitude: 0, timestamp: startTime, segmentStart: true },
    { latitude: 0, longitude: 0.001, timestamp: '2026-10-26T12:00:02Z' },
    { latitude: 1, longitude: 1, timestamp: '2026-10-26T12:10:00Z', segmentStart: true },
  ] });
  const controller = new ActivitiesController({ getActivityDetail } as any, {} as any);
  const response = { setHeader: jest.fn(), send: jest.fn(value => value) };
  await controller.exportGpx({ id: 'owner' } as any, 'activity', response as any);
  const xml = response.send.mock.calls[0][0] as string;
  expect(getActivityDetail).toHaveBeenCalledWith('activity', 'owner');
  expect(xml.match(/<trkseg>/g)).toHaveLength(2);
  expect(xml.match(/<trkpt /g)).toHaveLength(3);
  expect(xml).toContain(`<metadata><time>${startTime}</time></metadata>`);
  expect(xml).toContain('</trkseg>\n    <trkseg>');
});
