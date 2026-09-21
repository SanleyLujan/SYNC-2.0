import { Injectable } from '@nestjs/common';

// A lease is renewed only while the app is in the foreground. Lost connections
// and killed apps expire even if the transport never delivers a disconnect.
export const PRESENCE_TTL_MS = 45_000;

@Injectable()
export class ChatPresenceService {
  private leases = new Map<string, { userId: string; expiresAt: number }>();

  heartbeat(socketId: string, userId: string) {
    this.leases.set(socketId, { userId, expiresAt: Date.now() + PRESENCE_TTL_MS });
  }

  disconnect(socketId: string) {
    this.leases.delete(socketId);
  }

  isOnline(userId: string) {
    const now = Date.now();
    let online = false;
    for (const [socketId, lease] of this.leases) {
      if (lease.expiresAt <= now) this.leases.delete(socketId);
      else if (lease.userId === userId) online = true;
    }
    return online;
  }
}
