import { computeUserXP } from './xp-system';
describe('XP presentation', () => {
  it.each([[0,1,0],[499,1,499],[500,2,0],[1000,3,0]])('matches the server 500-XP curve at %i XP', (total, level, current) => {
    expect(computeUserXP(total)).toMatchObject({totalXP:total,level,currentLevelXP:current,nextLevelXP:500});
  });
});
