export {};
describe('Routing service contract',()=>{
  beforeEach(()=>{jest.resetModules();jest.spyOn(Date,'now').mockReturnValue(2000000);});
  afterEach(()=>jest.restoreAllMocks());
  it('selects actual foot/bike providers and reuses identical requests',async()=>{
    const fetchMock=jest.fn().mockResolvedValue({ok:true,json:async()=>({routes:[{distance:1000,duration:600,geometry:{coordinates:[[0,0],[.01,0]]}}]})});
    global.fetch=fetchMock;
    const {planRoute}=require('./routing.service');
    const from={latitude:0,longitude:0},to={latitude:0,longitude:.01};
    expect((await planRoute(from,to,'foot')).profile).toBe('foot');
    expect(fetchMock.mock.calls[0][0]).toContain('/routed-foot/route/v1/driving/');
    await planRoute(from,to,'foot'); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await planRoute(from,to,'bike')).toBeNull();
    (Date.now as jest.Mock).mockReturnValue(2002000);
    await planRoute(from,to,'bike'); expect(fetchMock.mock.calls[1][0]).toContain('/routed-bike/');
  });
  it('does not accept invalid coordinates or fabricate a fallback route on failure',async()=>{
    global.fetch=jest.fn().mockResolvedValue({ok:false});
    const {planRoute}=require('./routing.service');
    expect(await planRoute({latitude:NaN,longitude:0},{latitude:0,longitude:0})).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(await planRoute({latitude:0,longitude:0},{latitude:0,longitude:.01})).toBeNull();
  });
});
