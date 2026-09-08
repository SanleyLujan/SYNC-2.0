// Presentation-only adapter. totalXP must come from the backend; never estimate
// rewards from distance, activity count, streaks or achievements on the client.
export interface UserXP { totalXP: number; level: number; currentLevelXP: number; nextLevelXP: number; progress: number; title: string }
export function computeUserXP(totalXP: number): UserXP {
  const xp = Math.max(0, Math.floor(totalXP || 0));
  return { totalXP: xp, level: Math.floor(xp/500)+1, currentLevelXP: xp%500, nextLevelXP: 500, progress: (xp%500)/500, title: 'Praticante' };
}
