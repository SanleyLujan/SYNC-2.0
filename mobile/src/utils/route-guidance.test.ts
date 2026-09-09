import { routeGuidance } from './route-guidance';
const route=[{latitude:0,longitude:0},{latitude:0,longitude:.01}];
describe('Planned route guidance',()=>{
  it('does not fabricate location without GPS',()=>expect(routeGuidance(route)).toBeNull());
  it('estimates remaining distance and detects departure',()=>{
    expect(routeGuidance(route,{latitude:0,longitude:.005})?.remainingMeters).toBeCloseTo(557,0);
    expect(routeGuidance(route,{latitude:.01,longitude:.005})?.offRoute).toBe(true);
  });
  it('detects proximity to the destination',()=>expect(routeGuidance(route,route[1])?.arrived).toBe(true));
});
