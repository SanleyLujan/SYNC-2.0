import { ActivitiesGateway } from './activities.gateway';

function socket(id: string, token?: string) {
  return {
    id,
    handshake: { auth: token ? { token } : {}, headers: {} },
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  } as any;
}

describe('ActivitiesGateway privacy and flush', () => {
  const activityRepository = { findOne: jest.fn() };
  const pointRepository = {
    create: jest.fn((value) => value),
    save: jest.fn().mockResolvedValue(undefined),
  };
  const jwtService = { verify: jest.fn(() => ({ sub: 'owner-1' })) };
  let gateway: ActivitiesGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    pointRepository.create.mockImplementation((value) => value);
    gateway = new ActivitiesGateway(
      activityRepository as any,
      pointRepository as any,
      jwtService as any,
    );
    (gateway as any).server = {
      to: jest.fn(() => ({ emit: jest.fn() })),
    };
  });

  it('requires the exact live token before an anonymous observer joins', async () => {
    const client = socket('observer');
    await gateway.handleConnection(client);
    activityRepository.findOne.mockResolvedValue({
      id: 'activity-1',
      user_id: 'owner-1',
      liveToken: 'valid_token-1',
      liveTokenExpiresAt: new Date(Date.now() + 60_000),
    });

    const denied = await gateway.onJoin(client, {
      activityId: 'activity-1',
      liveToken: 'wrong',
    });
    expect(denied).toEqual({ ok: false, error: 'forbidden' });
    expect(client.join).not.toHaveBeenCalled();

    const allowed = await gateway.onJoin(client, {
      activityId: 'activity-1',
      liveToken: 'valid_token-1',
    });
    expect(allowed).toEqual({ ok: true, room: 'activity:activity-1' });
    expect(client.join).toHaveBeenCalledWith('activity:activity-1');
  });

  it('persists the final buffered point before REST finalization continues', async () => {
    const client = socket('athlete', 'jwt');
    await gateway.handleConnection(client);
    activityRepository.findOne.mockResolvedValue({
      id: 'activity-1',
      user_id: 'owner-1',
      isCompleted: false,
    });

    const pointResult = await gateway.onPoint(client, {
      activityId: 'activity-1',
      latitude: -23.55,
      longitude: -46.63,
      timestamp: '2026-09-02T10:00:00.000Z',
    });
    await gateway.flushOwnedActivity('activity-1', 'owner-1');

    expect(pointResult).toEqual({ ok: true });
    expect(pointRepository.save).toHaveBeenCalledTimes(1);
    expect(pointRepository.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        activity_id: 'activity-1',
        latitude: -23.55,
        longitude: -46.63,
      }),
    ]);
  });
});
