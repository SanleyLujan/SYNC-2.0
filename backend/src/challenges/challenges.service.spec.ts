import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChallengesService, validateChallenge } from './challenges.service';
describe('Challenges: bounded goals and authorization', () => {
  const valid = { challengedId:'b', sport:'gym', metric:'duration', target:10, expiresInDays:3 };
  it.each([5,10,15])('allows short duration %i', target => expect(() => validateChallenge({...valid,target})).not.toThrow());
  it.each([NaN,Infinity,-1,0,100,1000])('rejects target %s', target => expect(() => validateChallenge({...valid,target})).toThrow(BadRequestException));
  it('rejects pace, distance at gym, unknown sports and long deadlines', () => {
    for(const patch of [{metric:'pace'},{metric:'distance'},{sport:'unknown'},{expiresInDays:30}]) expect(()=>validateChallenge({...valid,...patch})).toThrow();
  });
  it('blocks self challenge before accessing database', async () => {
    const service = new ChallengesService({} as any,{} as any);
    await expect(service.create('b',valid)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('never allows a participant to declare victory; also rejects third parties', async () => {
    const repo = { findOneBy: jest.fn().mockResolvedValue({challenger_id:'a',challenged_id:'b',status:'accepted'}) };
    const service = new ChallengesService({getRepository:()=>repo} as any,{} as any);
    await expect(service.complete('a','c')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.complete('outsider','c')).rejects.toBeInstanceOf(ForbiddenException);
    repo.findOneBy.mockResolvedValue(null);
    await expect(service.complete('a','c')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('rejects expired invitations, third parties and non-boolean consent', async () => {
    const repo = {findOne:jest.fn().mockResolvedValue({challenged_id:'b',status:'pending',ruleVersion:1,expiresAt:new Date(0)})};
    const service = new ChallengesService({getRepository:()=>repo} as any,{} as any);
    await expect(service.respond('b','c',true)).rejects.toThrow('encerrado');
    await expect(service.respond('outsider','c',true)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.respond('b','c','true' as any)).rejects.toThrow('inválida');
  });
});
