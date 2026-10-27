jest.mock('./api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() } }));
import api from './api';
import { eventsService } from './events.service';

beforeEach(() => jest.clearAllMocks());

it('envia os nomes de coordenadas e raio esperados pela API do mapa', async () => {
  (api.get as jest.Mock).mockResolvedValue({ data: [] });
  await eventsService.getNearby(0, -46, 15, 'running');
  expect(api.get).toHaveBeenCalledWith('/events/nearby', {
    params: { latitude: 0, longitude: -46, radiusKm: 15, sport: 'running' },
  });
});

it('devolve a contagem e a participação confirmadas pelo servidor ao entrar e sair', async () => {
  const joined = { id: 'event', participantCount: 4, isJoined: true };
  const left = { id: 'event', participantCount: 2, isJoined: false };
  (api.post as jest.Mock).mockResolvedValue({ data: joined });
  (api.delete as jest.Mock).mockResolvedValue({ data: left });
  expect(await eventsService.join('event')).toEqual(joined);
  expect(await eventsService.leave('event')).toEqual(left);
});
