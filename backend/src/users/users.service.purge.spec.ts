import { DataSource } from 'typeorm';
import { testDataSource } from '../common/testing/test-data-source';
import { UsersService } from './users.service';
import { UsersCleanupService } from './users-cleanup.service';
import { User } from './entities/user.entity';
import { RETAINED_CONTENT, retainContentRemoval } from './account-retention';

describe('account retention (real database)', () => {
  let db: DataSource, service: UsersService, removed: User, active: User;
  beforeEach(async () => {
    db = await testDataSource();
    [removed, active] = await db.getRepository(User).save([
      { name: 'Preserved name', email: 'retained@test.invalid', password: 'hash' },
      { name: 'Active', email: 'active@test.invalid', password: 'hash' },
    ]);
    service = new UsersService(db.getRepository(User), db.getRepository('user_blocks'),
      db.getRepository('user_reports'), db.getRepository('matches'));
  });
  afterEach(async () => { await db?.destroy(); });

  it('hides every public dependency, preserves original data, revokes sessions and leaves other accounts available', async () => {
    const ids: Record<string, string> = { users: removed.id };
    for (const [table, links] of Object.entries(RETAINED_CONTENT)) {
      const repo = db.getRepository(table);
      const row: Record<string, any> = {};
      for (const col of repo.metadata.columns) {
        const parent = links[col.databaseName];
        if (parent) { row[col.propertyName] = ids[parent]; continue; }
        if (col.isGenerated || col.isNullable || col.default !== undefined || col.isCreateDate || col.isUpdateDate || col.isDeleteDate) continue;
        row[col.propertyName] = col.type === Date || col.type === 'datetime' ? new Date() :
          col.type === Number || ['int', 'float', 'integer', 'real', 'bigint'].includes(String(col.type)) ? 1 :
          col.type === Boolean || col.type === 'boolean' ? false : 'test';
      }
      ids[table] = (await repo.save(row)).id;
    }
    await db.getRepository('refresh_tokens').save({ userId: removed.id, familyId: 'test', tokenHash: 'hash', expiresAt: new Date() });
    // A notification in another account can embed the removed actor's name.
    await db.getRepository('notifications').save({ user_id: active.id, type: 'new_message', title: 'Comment', body: removed.name,
      data: JSON.stringify({ commentId: ids.activity_comments }) });
    await service.deactivateAccount(removed.id);
    expect(await db.getRepository(User).findOneBy({ id: removed.id })).toBeNull();
    await expect(service.publicProfile(removed.id)).rejects.toThrow();
    const retained = await db.getRepository(User).findOne({ where: { id: removed.id }, withDeleted: true });
    expect(retained).toMatchObject({ name: 'Preserved name', email: 'retained@test.invalid', isActive: false });
    expect(await db.getRepository(User).findOneBy({ id: active.id })).not.toBeNull();
    for (const table of Object.keys(RETAINED_CONTENT)) {
      expect({ table, count: await db.getRepository(table).count() }).toEqual({ table, count: 0 });
      expect(await db.getRepository(table).findOne({ where: { id: ids[table] }, withDeleted: true })).not.toBeNull();
    }
    expect(await db.getRepository('refresh_tokens').findOneBy({ userId: removed.id })).toMatchObject({ revoked: true });
    await new UsersCleanupService().purgeExpiredDeletions();
    expect(await db.getRepository(User).count({ withDeleted: true })).toBe(2);
  });

  it('rolls back deactivation if archiving any dependency fails', async () => {
    await db.getRepository('matches').save({ user1_id: removed.id, user2_id: active.id });
    await db.query(`CREATE TRIGGER fail_archive BEFORE UPDATE ON matches BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`);
    await expect(service.deactivateAccount(removed.id)).rejects.toThrow('simulated failure');
    expect(await db.getRepository(User).findOneBy({ id: removed.id })).toMatchObject({ isActive: true });
    expect(await db.getRepository('matches').count()).toBe(1);
  });

  it('keeps other authors visible and preserves retained comments when their parent is removed later', async () => {
    const posts = db.getRepository('activity_feed_posts');
    const post = await posts.save({ user_id: active.id, caption: 'Still visible', commentsCount: 1 });
    const comments = db.getRepository('feed_comments');
    const comment = await comments.save({ post_id: post.id, user_id: removed.id, text: 'Preserved evidence' });
    await service.deactivateAccount(removed.id);
    expect(await posts.findOneBy({ id: post.id })).toMatchObject({ caption: 'Still visible', commentsCount: 0 });
    expect(await comments.count()).toBe(0);
    await retainContentRemoval(posts, post.id);
    expect(await posts.findOneBy({ id: post.id })).toBeNull();
    expect(await comments.findOne({ where: { id: comment.id }, withDeleted: true })).toMatchObject({ text: 'Preserved evidence' });
  });
});
