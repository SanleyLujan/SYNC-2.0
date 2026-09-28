import { DataSource } from 'typeorm';
import { testDataSource } from '../common/testing/test-data-source';
import { MatchingService } from './matching.service';
import { User } from '../users/entities/user.entity';
import { UserBlock } from '../users/entities/user-block.entity';
import { Like } from './entities/like.entity';
import { Match } from './entities/match.entity';
import { Activity } from '../activities/entities/activity.entity';

describe('matching decisions (real database)', () => {
  let db: DataSource, service: MatchingService, a: User, b: User;
  beforeEach(async () => {
    db = await testDataSource();
    [a, b] = await db.getRepository(User).save([
      { name: 'A', email: 'a@test.invalid', password: 'hash', latitude: 1, longitude: 1, onboardingCompleted: true },
      { name: 'B', email: 'b@test.invalid', password: 'hash', latitude: 1, longitude: 1, onboardingCompleted: true },
    ]);
    service = new MatchingService(db.getRepository(User), db.getRepository(Like), db.getRepository(Match),
      db.getRepository(Activity), { sendToUser: jest.fn().mockResolvedValue({}) } as any);
  });
  afterEach(async () => { await db?.destroy(); });

  it('never counts a pass as a like or a reciprocal match', async () => {
    await service.swipe(a.id, { targetUserId: b.id, isLike: false });
    expect(await service.getLikesReceivedCount(b.id)).toBe(0);
    expect(await service.swipe(b.id, { targetUserId: a.id, isLike: true })).toEqual({ matched: false });
    expect(await db.getRepository(Match).count()).toBe(0);
    expect(await db.getRepository(Like).findOneBy({ from_user_id: a.id })).toMatchObject({ isLike: false });
  });

  it('allows changing a pass into a like and makes retries idempotent', async () => {
    await service.swipe(a.id, { targetUserId: b.id, isLike: false });
    await service.swipe(b.id, { targetUserId: a.id, isLike: true });
    const match = await service.swipe(a.id, { targetUserId: b.id, isLike: true });
    expect(match.matched).toBe(true);
    const like = await db.getRepository(Like).findOneByOrFail({ from_user_id: a.id });
    expect(await service.swipe(a.id, { targetUserId: b.id, isLike: true })).toEqual(match);
    expect((await db.getRepository(Like).findOneByOrFail({ id: like.id })).createdAt).toEqual(like.createdAt);
    expect(await db.getRepository(Match).count()).toBe(1);
  });

  it('excludes unknown legacy actions from likes and allows discovery again', async () => {
    await db.getRepository(Like).save({ from_user_id: a.id, to_user_id: b.id, isLike: null });
    expect(await service.getLikesReceived(b.id)).toEqual([]);
    expect((await service.discover(a.id, {})).map(user => user.id)).toContain(b.id);
    expect((await service.swipe(b.id, { targetUserId: a.id, isLike: true })).matched).toBe(false);
  });

  it('lists positive likes with the decision timestamp and first profile photo', async () => {
    await db.getRepository(User).update(a.id, { avatarUrl: 'avatar', profilePhotos: ['first', 'second'] });
    await service.swipe(a.id, { targetUserId: b.id, isLike: true });
    const likes = await service.getLikesReceived(b.id);
    expect(likes).toHaveLength(1);
    expect(likes[0].createdAt).toBeInstanceOf(Date);
    expect(likes[0].user?.avatarUrl).toBe('first');
  });

  it('rejects inactive and blocked targets', async () => {
    await db.getRepository(User).update(b.id, { isActive: false });
    await expect(service.swipe(a.id, { targetUserId: b.id, isLike: true })).rejects.toThrow('Perfil indisponível');
    await db.getRepository(User).update(b.id, { isActive: true });
    await db.getRepository(UserBlock).save({ blocker_id: b.id, blocked_id: a.id });
    await expect(service.swipe(a.id, { targetUserId: b.id, isLike: true })).rejects.toThrow('Perfil indisponível');
  });
});
