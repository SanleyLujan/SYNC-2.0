import { clearWebTrackingRecovery, getWebTrackingRecovery, getWebTrackingRecoveryEpoch, saveWebTrackingRecovery, WebTrackingRecovery } from './web-tracking-recovery.service';

let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => values.set(key, value)),
    removeItem: jest.fn((key: string) => values.delete(key)),
  } });
});
afterEach(() => { delete (globalThis as any).localStorage; });

const session = (): WebTrackingRecovery => ({
  userId: 'user-a', activityId: 'activity-a', sport: 'running', startedAt: 1_000,
  totalPausedMs: 2_000, pausedAt: 8_000, pauseSource: 'manual', syncedThrough: 0,
  points: [{ latitude: -23.5, longitude: -46.5, timestamp: 3_000, segmentStart: true }],
  pendingTimingEvents: [{ action: 'pause', occurredAt: 8_000 }], autoPauseOn: true,
  plannedRoute: [], targetGoal: null,
});

it('recupera pontos e pausas pendentes após recarga e isola a conta', () => {
  expect(saveWebTrackingRecovery(session())).toBe(true);
  expect(getWebTrackingRecovery('user-a')).toEqual(session());
  expect(getWebTrackingRecovery('user-b')).toBeNull();
  expect(getWebTrackingRecovery()).toBeNull();
  clearWebTrackingRecovery();
  expect(getWebTrackingRecovery('user-a')).toBeNull();
});

it('também preserva treinos sem GPS', () => {
  const workout = { ...session(), sport: 'gym', points: [] };
  saveWebTrackingRecovery(workout);
  expect(getWebTrackingRecovery('user-a')?.sport).toBe('gym');
});

it('sinaliza falha de armazenamento sem apagar a última cópia salva', () => {
  saveWebTrackingRecovery(session());
  (localStorage.setItem as jest.Mock).mockImplementation(() => { throw new Error('QuotaExceededError'); });
  expect(saveWebTrackingRecovery({ ...session(), points: [] })).toBe(false);
  expect(getWebTrackingRecovery('user-a')?.points).toHaveLength(1);
});

it('ignora dados corrompidos e coordenadas inválidas', () => {
  values.set('@sync:web-tracking-recovery', '{');
  expect(getWebTrackingRecovery('user-a')).toBeNull();
  saveWebTrackingRecovery({ ...session(), points: [{ ...session().points[0], latitude: 100 }] });
  expect(getWebTrackingRecovery('user-a')).toBeNull();
});

it('uma resposta tardia ou desmontagem não recria o treino após logout ou finalização', () => {
  const epoch = getWebTrackingRecoveryEpoch();
  saveWebTrackingRecovery(session(), epoch);
  clearWebTrackingRecovery();
  expect(saveWebTrackingRecovery(session(), epoch)).toBe(false);
  expect(getWebTrackingRecovery('user-a')).toBeNull();
});
