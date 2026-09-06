export function calculateActiveDurationSeconds(input: {
  startedAt: number | null;
  now?: number;
  totalPausedMs?: number;
  pausedAt?: number | null;
}): number {
  if (input.startedAt == null || !Number.isFinite(input.startedAt)) return 0;
  const now = input.now ?? Date.now();
  const completedPauses = Math.max(0, input.totalPausedMs || 0);
  const openPause = input.pausedAt == null ? 0 : Math.max(0, now - input.pausedAt);
  return Math.max(0, Math.floor((now - input.startedAt - completedPauses - openPause) / 1000));
}
