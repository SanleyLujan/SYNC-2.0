import { achievementRules, AVAILABLE_ACHIEVEMENTS } from './achievement-rules';
import { AchievementType as A } from './entities/achievement.entity';
const social={matches:0,events:0,superLikes:0,kudos:0,comments:0,stories:0,messages:0,flash:0,profileComplete:false};
describe('Achievement evidence',()=>{
  it('does not invent achievements for an empty account or unavailable weather',()=>{
    expect(achievementRules([],social)).toEqual([]); expect(AVAILABLE_ACHIEVEMENTS).not.toContain(A.RAIN_RUNNER);
  });
  it('separates cycling from running performance and uses local time',()=>{
    const a={sport:'cycling',startTime:new Date('2026-09-08T08:30:00Z'),distance:5000,duration:900,elevationGain:0};
    const won=achievementRules([a],social,new Date('2026-09-08T18:00:00Z'));
    expect(won).toContain(A.EARLY_BIRD); expect(won).not.toContain(A.SPEED_DEMON); expect(won).not.toContain(A.PACE_5MIN);
  });
  it('covers previously omitted count, distance and streak thresholds',()=>{
    const activities=Array.from({length:365},(_,i)=>({sport:'walking',startTime:new Date(Date.UTC(2024,0,1+i,15)),distance:3000,duration:3600,elevationGain:0}));
    const won=achievementRules(activities,social,new Date('2026-09-08T18:00:00Z'));
    expect(won).toEqual(expect.arrayContaining([A.ACTIVITIES_365,A.STREAK_14,A.STREAK_100,A.STREAK_365,A.DISTANCE_1000K]));
  });
});
