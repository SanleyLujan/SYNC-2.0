jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('./api', () => ({ API_HOST: 'https://example.invalid' }));
jest.mock('./secure-storage', () => ({ secureStorage: { getItem: jest.fn() } }));
import { io } from 'socket.io-client';
import { secureStorage } from './secure-storage';
import { socketService } from './socket.service';

let sockets: any[];
const tick = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function connectSocket(socket: any) {
  socket.connected = true;
  socket.handlers.get('connect')();
}
beforeEach(() => {
  jest.useFakeTimers();
  socketService.disconnect();
  jest.clearAllMocks();
  (secureStorage.getItem as jest.Mock).mockResolvedValue('private-test-token');
  sockets = [];
  (io as jest.Mock).mockImplementation(() => {
    const handlers = new Map<string, Function>();
    const socket: any = {
      handlers, connected: false,
      on: jest.fn((event, callback) => handlers.set(event, callback)),
      off: jest.fn(event => handlers.delete(event)),
      emit: jest.fn(),
      removeAllListeners: jest.fn(() => handlers.clear()),
      disconnect: jest.fn(() => { socket.connected = false; }),
    };
    sockets.push(socket);
    return socket;
  });
});
afterEach(() => { socketService.disconnect(); jest.useRealTimers(); });

it('never opens a connection in the background', async () => {
  await expect(socketService.connect()).rejects.toThrow('segundo plano');
  expect(io).not.toHaveBeenCalled();
});

it('shares one connection and renews presence only while the app is active', async () => {
  socketService.setAppActive(true);
  const attempt = socketService.connect();
  expect(socketService.connect()).toBe(attempt);
  await tick();
  connectSocket(sockets[0]);
  await attempt;
  expect(io).toHaveBeenCalledTimes(1);
  expect(sockets[0].emit).toHaveBeenCalledWith('presenceHeartbeat');
  jest.advanceTimersByTime(30_000);
  expect(sockets[0].emit).toHaveBeenCalledTimes(3);
  socketService.setAppActive(false);
  expect(sockets[0].disconnect).toHaveBeenCalled();
  expect(socketService.getStatus()).toBe('disconnected');
  jest.advanceTimersByTime(90_000);
  expect(io).toHaveBeenCalledTimes(1);
  expect(sockets[0].emit).toHaveBeenCalledTimes(3);
});

it('restores chat subscriptions after returning to the app', async () => {
  const handler = jest.fn();
  socketService.onNewMessage(handler);
  socketService.joinChat('match');
  socketService.setAppActive(true);
  await tick(); connectSocket(sockets[0]); await tick();
  socketService.setAppActive(false);
  socketService.setAppActive(true);
  await tick(); connectSocket(sockets[1]); await tick();
  expect(sockets[1].emit).toHaveBeenCalledWith('joinChat', { matchId: 'match' });
  sockets[1].handlers.get('newMessage')({ id: 'message' });
  expect(handler).toHaveBeenCalledWith({ id: 'message' });
});

it('cancels a delayed token read when the app becomes inactive', async () => {
  let release!: (token: string) => void;
  (secureStorage.getItem as jest.Mock).mockReturnValueOnce(new Promise(resolve => { release = resolve; }));
  socketService.setAppActive(true);
  socketService.setAppActive(false);
  release('old-token'); await tick();
  expect(io).not.toHaveBeenCalled();
});

it('stops pending reconnects and discards rooms and handlers on logout', async () => {
  socketService.joinChat('old-match');
  socketService.onNewMessage(jest.fn());
  socketService.setAppActive(true);
  await tick();
  sockets[0].handlers.get('connect_error')(new Error('network'));
  await tick();
  socketService.disconnect();
  jest.advanceTimersByTime(60_000);
  expect(io).toHaveBeenCalledTimes(1);
  socketService.setAppActive(true);
  await tick(); connectSocket(sockets[1]); await tick();
  expect(sockets[1].emit).not.toHaveBeenCalledWith('joinChat', expect.anything());
  expect(sockets[1].handlers.has('newMessage')).toBe(false);
});
