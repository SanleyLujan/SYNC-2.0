jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('./api', () => ({ __esModule: true, default: { get: jest.fn(async () => ({})) }, API_HOST: 'https://example.invalid' }));
jest.mock('./secure-storage', () => ({ secureStorage: { getItem: jest.fn(async () => 'private-jwt') } }));
import { io } from 'socket.io-client';
import { TrackingSocketService } from './tracking-socket.service';
import { secureStorage } from './secure-storage';

it('observador anônimo reinscreve a live em cada reconexão sem enviar JWT', async () => {
  const handlers = new Map<string, Function>();
  const socket: any = {
    connected: false,
    on: jest.fn((event, callback) => handlers.set(event, callback)),
    off: jest.fn((event) => handlers.delete(event)),
    emit: jest.fn(), removeAllListeners: jest.fn(), disconnect: jest.fn(),
  };
  (io as jest.Mock).mockReturnValue(socket);
  const service = new TrackingSocketService(true);
  const off = service.follow('activity', 'public-token', jest.fn());
  const auth = jest.fn();
  (io as jest.Mock).mock.calls[0][1].auth(auth);
  await Promise.resolve();
  expect(auth).toHaveBeenCalledWith({});
  expect(secureStorage.getItem).not.toHaveBeenCalled();
  socket.connected = true;
  handlers.get('connect')!(); handlers.get('connect')!();
  expect(socket.emit).toHaveBeenCalledTimes(2);
  expect(socket.emit).toHaveBeenCalledWith('joinActivity', { activityId:'activity',liveToken:'public-token' }, expect.any(Function));
  expect(service.connect()).toBe(socket);
  expect(io).toHaveBeenCalledTimes(1);
  off(); expect(handlers.has('connect')).toBe(false);
});
