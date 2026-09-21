import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatPresenceService, PRESENCE_TTL_MS } from './chat-presence.service';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

describe('foreground presence leases', () => {
  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-09-21T12:00:00Z')));
  afterEach(() => jest.useRealTimers());

  it('expires killed or unreachable apps even without a disconnect event', () => {
    const presence = new ChatPresenceService();
    presence.heartbeat('socket', 'alice');
    expect(presence.isOnline('alice')).toBe(true);
    jest.advanceTimersByTime(PRESENCE_TTL_MS);
    expect(presence.isOnline('alice')).toBe(false);
    presence.heartbeat('socket', 'alice');
    expect(presence.isOnline('alice')).toBe(true);
  });

  it('keeps a user online while another foreground device is still active', () => {
    const presence = new ChatPresenceService();
    presence.heartbeat('phone', 'alice');
    presence.heartbeat('browser', 'alice');
    presence.disconnect('phone');
    expect(presence.isOnline('alice')).toBe(true);
    expect(presence.isOnline('bob')).toBe(false);
    jest.advanceTimersByTime(PRESENCE_TTL_MS - 1000);
    presence.heartbeat('browser', 'alice');
    jest.advanceTimersByTime(1000);
    expect(presence.isOnline('alice')).toBe(true);
    presence.disconnect('browser');
    expect(presence.isOnline('alice')).toBe(false);
  });
});

describe('presence access', () => {
  let service: ChatService;
  let controller: ChatController;
  let messages: any;
  let users: any;
  beforeEach(() => {
    messages = { manager: { findOne: jest.fn().mockResolvedValue(null) } };
    users = { findOne: jest.fn().mockResolvedValue({ id: 'bob', isActive: true, deletedAt: null }) };
    service = new ChatService(messages, { findOne: jest.fn().mockResolvedValue({ id: 'match', user1_id: 'alice', user2_id: 'bob' }) } as any, users, {} as any);
    const presence = new ChatPresenceService();
    presence.heartbeat('alice-phone', 'alice');
    controller = new ChatController(service, presence);
  });

  it('returns the peer status, never the viewing user connection', async () => {
    expect(await controller.getPresence({ id: 'alice' } as any, 'match')).toEqual({ userId: 'bob', online: false });
  });

  it('does not reveal the presence of a user outside the caller match', async () => {
    await expect(controller.getPresence({ id: 'stranger' } as any, 'match')).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('hides presence after a block in either direction', async () => {
    messages.manager.findOne.mockResolvedValue({ id: 'block' });
    await expect(service.presencePeer('match', 'alice')).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.manager.findOne).toHaveBeenCalledWith(expect.anything(), { where: [
      { blocker_id: 'alice', blocked_id: 'bob' }, { blocker_id: 'bob', blocked_id: 'alice' },
    ] });
  });

  it('hides deactivated and removed profiles', async () => {
    users.findOne.mockResolvedValue(null);
    await expect(service.presencePeer('match', 'alice')).rejects.toBeInstanceOf(NotFoundException);
    users.findOne.mockResolvedValue({ deletedAt: new Date() });
    await expect(service.presencePeer('match', 'alice')).rejects.toBeInstanceOf(NotFoundException);
  });
});
