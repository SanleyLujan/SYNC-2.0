import axios from 'axios';
import { PlacesService, parseGyms } from './places.service';
jest.mock('axios');
const post = axios.post as jest.Mock;
const gym = { type: 'node', id: 1, lat: -22.47, lon: -44.45, tags: { leisure: 'fitness_centre', name: 'Academia teste' } };

describe('Real gym lookup', () => {
  beforeEach(() => jest.resetAllMocks());
  it('accepts nodes and area centers, deduplicates IDs and excludes non-gyms/private/invalid/distant places', () => {
    const result = parseGyms([gym, gym,
      { ...gym, id: 2, type: 'way', lat: undefined, lon: undefined, center: { lat: -22.47, lon: -44.45 } },
      { ...gym, id: 3, tags: { leisure: 'fitness_station' } },
      { ...gym, id: 4, tags: { ...gym.tags, access: 'private' } },
      { ...gym, id: 5, lat: 'bad' }, { ...gym, id: 6, lat: 0 },
    ], -22.47, -44.45);
    expect(result.map(p => p.id)).toEqual(['node/1', 'way/2']);
    expect(result[0].sourceUrl).toBe('https://www.openstreetmap.org/node/1');
  });
  it('rejects invalid coordinates without contacting the provider', async () => {
    const service = new PlacesService();
    for (const coords of [['', '0'], ['NaN','0'], ['91','0'], ['0','181'], ['0);out;','0']]) {
      await expect(service.nearby(coords[0], coords[1])).rejects.toThrow();
    }
    expect(post).not.toHaveBeenCalled();
  });
  it('uses a shared cache and sends rounded coordinates without user data', async () => {
    post.mockResolvedValue({ data: { elements: [gym] } });
    const service = new PlacesService();
    expect((await service.nearby('-22.47123', '-44.45123')).places).toHaveLength(1);
    await service.nearby('-22.47124', '-44.45124');
    expect(post).toHaveBeenCalledTimes(1);
    expect(decodeURIComponent(post.mock.calls[0][1])).toContain('-22.47,-44.45');
    expect(post.mock.calls[0][1]).not.toContain('47123');
  });
  it('returns genuine empty results but errors on failures or partial responses', async () => {
    post.mockResolvedValueOnce({ data: { elements: [] } });
    expect((await new PlacesService().nearby('0','0')).places).toEqual([]);
    post.mockRejectedValueOnce(new Error('network error'));
    await expect(new PlacesService().nearby('0','0')).rejects.toThrow('Não foi possível');
    post.mockResolvedValueOnce({ data: { elements: [gym], remark: 'timeout' } });
    await expect(new PlacesService().nearby('0','0')).rejects.toThrow('Não foi possível');
  });
  it('limits uncached upstream requests globally', async () => {
    post.mockResolvedValue({ data: { elements: [] } });
    const service = new PlacesService();
    await service.nearby('0','0');
    await expect(service.nearby('1','1')).rejects.toThrow('ocupada');
    expect(post).toHaveBeenCalledTimes(1);
  });
});
