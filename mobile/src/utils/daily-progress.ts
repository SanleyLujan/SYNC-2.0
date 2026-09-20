export function dailyDeadline(data: { serverNow?: string; resetsAt?: string }, receivedAt: number) {
  const server = Date.parse(data.serverNow || ''), reset = Date.parse(data.resetsAt || '');
  return Number.isFinite(server) && Number.isFinite(reset) ? receivedAt + Math.max(0, reset - server) : receivedAt;
}

export function currentDailySnapshot<T>(snapshot: { userId: string; expiresAt: number; data: T } | null, userId: string | undefined, now: number): T | null {
  return snapshot && snapshot.userId === userId && now < snapshot.expiresAt ? snapshot.data : null;
}
