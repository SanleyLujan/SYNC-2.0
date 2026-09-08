export {};
const mockValues = new Map<string, string>();
let mockTask: any;
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (k: string) => mockValues.get(k) || null),
  setItem: jest.fn(async (k: string, v: string) => { mockValues.set(k,v); }),
  removeItem: jest.fn(async (k: string) => { mockValues.delete(k); }),
} }));
jest.mock('expo-task-manager', () => ({ isTaskDefined: () => false, defineTask: (_: string, task: any) => { mockTask = task; }, isAvailableAsync: jest.fn(async () => true) }));
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  hasStartedLocationUpdatesAsync: async () => false,
  startLocationUpdatesAsync: jest.fn(), stopLocationUpdatesAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6 }, ActivityType: { Fitness: 3 },
}));

describe('fila durável de localização', () => {
  let service: typeof import('./background-tracking.service');
  const point = (timestamp: number, latitude = -23.5) => ({ timestamp, coords: { latitude, longitude: -46.5, accuracy: 5 } });
  const start = Date.now() - 60_000;
  beforeEach(async () => {
    jest.resetModules(); jest.clearAllMocks(); mockValues.clear();
    service = require('./background-tracking.service');
    await service.startBackgroundTracking({ activityId: 'a', sport: 'running', startedAt: new Date(start).toISOString() });
    service.setBackgroundAppForeground(false);
  });
  it('mantém pontos após leitura/reinício e só remove os confirmados', async () => {
    await mockTask({ data: { locations: [point(start+1000), point(start+2000), point(start+1000)] } });
    expect((await service.drainBackgroundPoints('a')).length).toBe(2);
    expect((await service.drainBackgroundPoints('a')).length).toBe(2);
    await service.acknowledgeBackgroundPoints('a', [start+1000]);
    expect((await service.drainBackgroundPoints('a')).map(p => p.timestamp)).toEqual([start+2000]);
  });
  it('não captura durante pausa manual, nem após logout', async () => {
    await service.setBackgroundTrackingManualPause(true);
    await mockTask({ data: { locations: [point(start+1000)] } });
    expect(await service.drainBackgroundPoints('a')).toEqual([]);
    await service.stopBackgroundTracking({ clearQueue: true });
    await mockTask({ data: { locations: [point(start+2000)] } });
    expect(await service.getBackgroundTrackingContext()).toBeNull();
    expect(await service.drainBackgroundPoints('a')).toEqual([]);
  });
  it('descarta fix inválido ou anterior ao treino e isola atividades', async () => {
    await mockTask({ data: { locations: [point(start-1000),point(start+1000,100),point(start+2000)] } });
    expect(await service.drainBackgroundPoints('other')).toEqual([]);
    await service.acknowledgeBackgroundPoints('other',[start+2000]);
    expect((await service.drainBackgroundPoints('a')).length).toBe(1);
  });
  it('web preserva contexto, mas não promete task de segundo plano', async () => {
    require('react-native').Platform.OS = 'web';
    expect(await service.startBackgroundTracking({ activityId: 'web', sport: 'walking', startedAt: new Date(start).toISOString() })).toBe(false);
    expect((await service.getBackgroundTrackingContext())?.activityId).toBe('web');
  });
});
