import { AchievementType as A } from './entities/achievement.entity';
import { dayKey, DAY_ZONE } from '../gamification/rules';
import { shiftDay, summarizeStats } from '../stats/stats-rules';

// These need evidence not stored by the app; never advertise them as achievable.
export const UNAVAILABLE_ACHIEVEMENTS = new Set<A>([A.SUNRISE_RUN, A.RAIN_RUNNER, A.HEAT_WARRIOR,
  A.COLD_HERO, A.CITY_EXPLORER, A.EVENT_PARTICIPANT_10, A.STORYTELLER, A.SHARED_LIVE]);
export const AVAILABLE_ACHIEVEMENTS = Object.values(A).filter(a => !UNAVAILABLE_ACHIEVEMENTS.has(a));
export interface AchievementActivity {
  sport: string; startTime: Date; distance: number; duration: number; elevationGain: number;
}
export function achievementRules(activities: AchievementActivity[], social: { matches: number; events: number;
  superLikes: number; kudos: number; comments: number; stories: number; messages: number; flash: number;
  profileComplete: boolean; birthDate?: string | null }, now = new Date()): A[] {
  const won = new Set<A>();
  const check = (type: A, condition: boolean) => { if (condition) won.add(type); };
  const valid = activities.filter(a => a.duration >= 60 && new Date(a.startTime).getTime() <= now.getTime());
  const distanceSports = new Set(['running', 'walking', 'cycling', 'hiking']);
  const km = valid.filter(a => distanceSports.has(a.sport)).reduce((s,a) => s + Math.max(0,a.distance),0) / 1000;
  for (const [threshold, type] of [[1,A.FIRST_ACTIVITY],[10,A.ACTIVITIES_10],[50,A.ACTIVITIES_50],
    [100,A.ACTIVITIES_100],[365,A.ACTIVITIES_365],[1000,A.ACTIVITIES_1000]] as [number,A][]) check(type,valid.length>=threshold);
  for (const [threshold, type] of [[10,A.DISTANCE_10K],[50,A.DISTANCE_50K],[100,A.DISTANCE_100K],
    [500,A.DISTANCE_500K],[1000,A.DISTANCE_1000K],[2500,A.DISTANCE_2500K]] as [number,A][]) check(type,km>=threshold);
  const days = [...new Set(valid.map(a => dayKey(new Date(a.startTime))))].sort();
  const best = summarizeStats(days.map(date => ({ date, sport:'any', count:1, distance:0,duration:0,calories:0 })), 'all', now).bestStreak;
  for (const [threshold,type] of [[3,A.STREAK_3],[7,A.STREAK_7],[14,A.STREAK_14],[30,A.STREAK_30],
    [100,A.STREAK_100],[365,A.STREAK_365]] as [number,A][]) check(type,best>=threshold);
  const sports = new Set(valid.map(a=>a.sport)).size;
  check(A.MULTI_SPORT,sports>=3); check(A.ALL_ROUNDER,sports>=5);
  check(A.FIRST_MATCH,social.matches>=1); check(A.SOCIAL_BUTTERFLY,social.matches>=10); check(A.MATCHES_50,social.matches>=50);
  check(A.FIRST_EVENT,social.events>=1); check(A.EVENT_CREATOR,social.events>=5); check(A.EVENTS_HOSTED_10,social.events>=10);
  check(A.SUPER_LIKER,social.superLikes>=10); check(A.FIRST_KUDOS,social.kudos>=1);
  check(A.FIRST_COMMENT,social.comments>=1); check(A.FIRST_STORY,social.stories>=1); check(A.CHATTY,social.messages>=100);
  check(A.PROFILE_COMPLETE,social.profileComplete); check(A.FLASH_EVENT,social.flash>=1);
  const hourFormat = new Intl.DateTimeFormat('en-GB',{ timeZone:DAY_ZONE,hour:'2-digit',hourCycle:'h23' });
  for (const a of valid) {
    const hour=Number(hourFormat.format(new Date(a.startTime))), day=dayKey(new Date(a.startTime));
    check(A.EARLY_BIRD,hour<6); check(A.NIGHT_OWL,hour>=22); check(A.MIDNIGHT_RUN,hour>=23 || hour<1);
    check(A.NEW_YEAR_RUN,day.slice(5)==='01-01');
    check(A.BIRTHDAY_RUN,!!social.birthDate && day.slice(5)===social.birthDate.slice(5,10));
    check(A.HILL_CLIMBER,a.elevationGain>=500);
    if (a.sport === 'running' && a.distance >= 1000) {
      const pace=a.duration/60/(a.distance/1000), speed=a.distance/a.duration*3.6;
      check(A.SPEED_DEMON,speed>15 && speed<=30); check(A.PACE_5MIN,pace<5 && speed<=30);
      check(A.PACE_4MIN,pace<4 && speed<=30); check(A.LONG_RUN_21K,a.distance>=21097.5 && speed<=30);
      check(A.LONG_RUN_42K,a.distance>=42195 && speed<=30);
    }
  }
  const weeks = new Map<string,number>(), weekendWeeks = new Set<string>();
  for (const day of days) {
    const weekday=new Date(day+'T12:00:00Z').getUTCDay(), monday=shiftDay(day,-((weekday+6)%7));
    weeks.set(monday,(weeks.get(monday)||0)+1);
    if (weekday===0 || weekday===6) weekendWeeks.add(monday);
  }
  const consecutive = (list:string[], interval:number) => {
    let best=0, n=0; list.sort().forEach((d,i)=>{ n=i && shiftDay(list[i-1],interval)===d?n+1:1; best=Math.max(best,n); }); return best;
  };
  check(A.WEEKEND_WARRIOR,consecutive([...weekendWeeks],7)>=4);
  check(A.CONSISTENCY_KING,consecutive([...weeks].filter(([,n])=>n>=3).map(([day])=>day),7)>=12);
  check(A.COMEBACK_KID,days.some((d,i)=>i>0 && Date.parse(d)-Date.parse(days[i-1])>=30*86400000));
  return [...won].filter(a=>!UNAVAILABLE_ACHIEVEMENTS.has(a));
}
