import { ActivitiesService } from './activities.service';

describe('ActivitiesService GPS reconciliation and timing', () => {
  const activityRepository = { findOne: jest.fn(), update: jest.fn() };
  const pointRepository = {
    find: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const groupsService = { creditActivity: jest.fn().mockResolvedValue(undefined) };
  const segmentsMatch = { matchActivity: jest.fn().mockResolvedValue(undefined) };
  const userRepository = { findOne: jest.fn().mockResolvedValue({ id: 'owner-1', weightKg: 75, heightCm: 180 }) };
  const notificationsService = { create: jest.fn().mockResolvedValue(undefined) };
  const pushService = { sendToUser: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }) };
  let service: ActivitiesService;

  beforeEach(() => {
    jest.clearAllMocks();
    pointRepository.create.mockImplementation((value) => value);
    service = new ActivitiesService(
      activityRepository as any,
      pointRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      userRepository as any,
      notificationsService as any,
      pushService as any,
      groupsService as any,
      segmentsMatch as any,
    );
  });

  it('inserts only points whose original timestamp is not persisted yet', async () => {
    activityRepository.findOne.mockResolvedValue({ id: 'activity-1', isCompleted: false });
    pointRepository.find.mockResolvedValue([
      {
        latitude: -23.550501,
        longitude: -46.630001,
        timestamp: new Date('2026-09-02T10:00:00.000Z'),
      },
    ]);

    const inserted = await service.reconcilePoints('activity-1', 'owner-1', [
      {
        // Coordenada propositalmente diferente: o timestamp é a identidade
        // estável porque `real` pode ser arredondado pelo banco.
        latitude: -23.5505009,
        longitude: -46.6300009,
        timestamp: '2026-09-02T10:00:00.000Z',
      },
      {
        latitude: -23.551,
        longitude: -46.631,
        timestamp: '2026-09-02T10:00:02.000Z',
      },
    ]);

    expect(inserted).toBe(1);
    expect(pointRepository.save).toHaveBeenCalledWith(
      [expect.objectContaining({ timestamp: new Date('2026-09-02T10:00:02.000Z') })],
      { chunk: 500 },
    );
  });

  it('excludes paused time and does not bridge route segments in the final metrics', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-04T10:01:00.000Z'));
    const activity = {
      id: 'activity-1',
      user_id: 'owner-1',
      startTime: new Date('2026-09-04T10:00:00.000Z'),
      pausedAt: null,
      pausedDuration: 20,
      isCompleted: false,
      points: [
        { latitude: 0, longitude: 0, timestamp: new Date('2026-09-04T10:00:00Z'), segmentStart: true },
        { latitude: 0, longitude: 0.001, timestamp: new Date('2026-09-04T10:00:10Z'), segmentStart: false },
        { latitude: 0, longitude: 1, timestamp: new Date('2026-09-04T10:00:40Z'), segmentStart: true },
        { latitude: 0, longitude: 1.001, timestamp: new Date('2026-09-04T10:00:50Z'), segmentStart: false },
      ],
    };
    activityRepository.findOne
      .mockResolvedValueOnce(activity)
      .mockResolvedValueOnce({ ...activity, isCompleted: true });

    await service.finish('activity-1', 'owner-1');

    expect(activityRepository.update).toHaveBeenCalledWith(
      'activity-1',
      expect.objectContaining({
        duration: 40,
        distance: expect.any(Number),
        isCompleted: true,
      }),
    );
    const update = activityRepository.update.mock.calls[0][1];
    expect(update.distance).toBeGreaterThan(220);
    expect(update.distance).toBeLessThan(225);
    jest.useRealTimers();
  });
});
