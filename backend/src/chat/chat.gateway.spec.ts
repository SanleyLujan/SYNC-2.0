import { ChatGateway } from './chat.gateway';

function socket(id = 'socket-1') {
  return {
    id,
    handshake: { auth: { token: 'jwt' }, headers: {} },
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
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
    gateway = new ChatGateway(chatService as any, jwtService as any);
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
});
