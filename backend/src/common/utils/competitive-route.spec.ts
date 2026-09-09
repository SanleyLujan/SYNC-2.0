import { competitiveRoute, matchGeometry } from './competitive-route';
const start=Date.parse('2026-09-08T12:00:00Z');
const activity = () => ({ isCompleted:true,sport:'walking',duration:120,startTime:new Date(start),endTime:new Date(start+120000),
  points:Array.from({length:121},(_,i)=>({latitude:0,longitude:i*.00001,timestamp:new Date(start+i*1000),segmentStart:false})) });
describe('Competitive GPS evidence',()=>{
  it('accepts a continuous saved track and matches its geometry',()=>{
    const a=activity(), points=competitiveRoute(a,start+121000);
    expect(points).toHaveLength(121); expect(matchGeometry(points,a.points)).not.toBeNull();
  });
  it('rejects unfinished, unsupported, out-of-window and teleport tracks',()=>{
    for (const a of [{...activity(),isCompleted:false},{...activity(),sport:'gym'}]) expect(competitiveRoute(a,start+121000)).toEqual([]);
    const a=activity(); a.points[10].longitude=1; expect(competitiveRoute(a,start+121000)).toEqual([]);
    const b=activity(); b.points[0].timestamp=new Date(start-30000); expect(competitiveRoute(b,start+121000)).toEqual([]);
  });
  it('does not award the same segment across a pause or a different middle route',()=>{
    const a=activity(), geometry=a.points.map(p=>({...p})); a.points[50].segmentStart=true;
    expect(matchGeometry(competitiveRoute(a,start+121000),geometry)).toBeNull();
    const b=activity(); geometry[60].latitude=.01;
    expect(matchGeometry(competitiveRoute(b,start+121000),geometry)).toBeNull();
  });
});
