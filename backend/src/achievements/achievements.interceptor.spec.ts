import { of, throwError, lastValueFrom } from 'rxjs';
import { AchievementsInterceptor } from './achievements.interceptor';
describe('Achievement server events',()=>{
  const service={checkAndUnlock:jest.fn().mockResolvedValue([])};
  const interceptor=new AchievementsInterceptor(service as any);
  const context=(url:string,method='POST')=>({getType:()=> 'http',switchToHttp:()=>({getRequest:()=>({originalUrl:url,method,user:{id:'owner'}})})}) as any;
  beforeEach(()=>jest.clearAllMocks());
  it('reconciles only after successful relevant writes',async()=>{
    await lastValueFrom(interceptor.intercept(context('/api/stories'),{handle:()=>of({ok:true})}));
    expect(service.checkAndUnlock).toHaveBeenCalledWith('owner');
  });
  it('does not process failed writes, GPS batches or read-only requests',async()=>{
    await expect(lastValueFrom(interceptor.intercept(context('/api/stories'),{handle:()=>throwError(()=>new Error('failed'))}))).rejects.toThrow();
    await lastValueFrom(interceptor.intercept(context('/api/activities/abc/points/batch'),{handle:()=>of({})}));
    await lastValueFrom(interceptor.intercept(context('/api/stories','GET'),{handle:()=>of({})}));
    expect(service.checkAndUnlock).not.toHaveBeenCalled();
  });
});
