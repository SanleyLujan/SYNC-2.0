import { ChatGateway } from './chat.gateway';
import { ChatPresenceService } from './chat-presence.service';

function socket(id = 'socket-1') {
  return {
    id,
    handshake: { auth: { token: 'jwt' }, headers: {} },
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    to: jest.fn(() => ({ emit: jest.fn() })),
  } as any;
}

describe('ChatGateway authorization', () => {
  const chatService = {
    assertMatchAccess: jest.fn(),
  };
  const jwtService = { verify: jest.fn(() => ({ sub: 'user-1' })) };
  let gateway: ChatGateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new ChatGateway(chatService as any, jwtService as any, new ChatPresenceService());
  });

  it('does not join a match room when the user is not a participant', async () => {
    const client = socket();
    gateway.handleConnection(client);
    chatService.assertMatchAccess.mockRejectedValueOnce(new Error('forbidden'));

    const result = await gateway.handleJoinChat(client, { matchId: 'match-1' });

    expect(result).toEqual({ ok: false, error: 'forbidden' });
    expect(client.join).not.toHaveBeenCalled();
    expect(client.emit).toHaveBeenCalledWith('error', {
      message: 'Acesso negado a esta conversa',
    });
  });

  it('joins only after database authorization succeeds', async () => {
    const client = socket();
    gateway.handleConnection(client);
    chatService.assertMatchAccess.mockResolvedValueOnce({ id: 'match-1' });

    const result = await gateway.handleJoinChat(client, { matchId: 'match-1' });

    expect(chatService.assertMatchAccess).toHaveBeenCalledWith('match-1', 'user-1');
    expect(client.join).toHaveBeenCalledWith('match:match-1');
    expect(result).toEqual({ ok: true });
  });

  it('only marks authenticated foreground heartbeats online and clears on disconnect', () => {
    const client = socket();
    gateway.handlePresenceHeartbeat(client);
    expect(gateway.isUserOnline('user-1')).toBe(false);
    gateway.handleConnection(client);
    expect(gateway.isUserOnline('user-1')).toBe(false);
    gateway.handlePresenceHeartbeat(client);
    expect(gateway.isUserOnline('user-1')).toBe(true);
    gateway.handleDisconnect(client);
    expect(gateway.isUserOnline('user-1')).toBe(false);
  });

  it('leaves a chat room without ending the user presence elsewhere in the app', async () => {
    const client = socket();
    gateway.handleConnection(client);
    gateway.handlePresenceHeartbeat(client);
    await gateway.handleLeaveChat(client, { matchId: 'match-1' });
    expect(client.leave).toHaveBeenCalledWith('match:match-1');
    expect(gateway.isUserOnline('user-1')).toBe(true);
  });
});
