import { EntityManager, ObjectLiteral, Repository } from 'typeorm';

// Ordered parents first, then their dependents. Security/audit records remain
// available only through their existing administrative access controls.
export const RETAINED_CONTENT: Record<string, Record<string, string>> = {
  likes: { from_user_id: 'users', to_user_id: 'users' },
  matches: { user1_id: 'users', user2_id: 'users' },
  activities: { user_id: 'users' },
  activity_feed_posts: { user_id: 'users', activity_id: 'activities' },
  groups: { admin_id: 'users' },
  events: { creator_id: 'users' },
  segments: { created_by: 'users' },
  stories: { user_id: 'users', activity_id: 'activities' },
  messages: { sender_id: 'users', match_id: 'matches' },
  follows: { follower_id: 'users', following_id: 'users' },
  activity_points: { activity_id: 'activities' },
  activity_comments: { user_id: 'users', activity_id: 'activities' },
  activity_kudos: { user_id: 'users', activity_id: 'activities' },
  activity_ratings: { user_id: 'users', activity_id: 'activities' },
  comment_reactions: { user_id: 'users', comment_id: 'activity_comments' },
  feed_likes: { user_id: 'users', post_id: 'activity_feed_posts' },
  feed_comments: { user_id: 'users', post_id: 'activity_feed_posts' },
  feed_comment_reactions: { user_id: 'users', comment_id: 'feed_comments' },
  event_participants: { user_id: 'users', event_id: 'events' },
  event_comments: { user_id: 'users', event_id: 'events' },
  group_members: { user_id: 'users', group_id: 'groups' },
  group_join_requests: { user_id: 'users', group_id: 'groups' },
  segment_efforts: { user_id: 'users', segment_id: 'segments', activity_id: 'activities' },
  story_views: { viewer_id: 'users', story_id: 'stories' },
  challenges: { challenger_id: 'users', challenged_id: 'users' },
  user_achievements: { user_id: 'users' },
  gamification_rewards: { user_id: 'users' },
  push_tokens: { user_id: 'users' },
  notifications: { user_id: 'users' },
};

export function retainedContentPredicate(links: Record<string, string>): string {
  return Object.entries(links).map(([column, parent]) => {
    const inactive = parent === 'users'
      ? '"isActive" = false OR "deletedAt" IS NOT NULL'
      : '"inactiveAt" IS NOT NULL';
    // Several historical foreign keys are varchar even on PostgreSQL UUID PKs.
    return `CAST("${column}" AS varchar) IN (SELECT CAST("id" AS varchar) FROM "${parent}" WHERE ${inactive})`;
  }).join(' OR ');
}

// Notification text can contain a removed account's name; its JSON payload
// links the actor or source content without a database foreign key.
export const INACTIVE_NOTIFICATION_SOURCE = ['users', 'matches', 'activities', 'activity_comments',
  'activity_feed_posts', 'feed_comments', 'events', 'groups', 'challenges', 'stories'].map(table => {
  const inactive = table === 'users' ? '"isActive" = false OR "deletedAt" IS NOT NULL' : '"inactiveAt" IS NOT NULL';
  return `EXISTS (SELECT 1 FROM "${table}" source WHERE (${inactive}) AND "notifications"."data" LIKE '%' || CAST(source."id" AS varchar) || '%')`;
}).join(' OR ');

export const RETENTION_SUMMARIES = [
  'UPDATE "groups" SET "memberCount" = (SELECT COUNT(*) FROM "group_members" m WHERE CAST(m."group_id" AS varchar) = CAST("groups"."id" AS varchar) AND m."inactiveAt" IS NULL), "totalDistanceKm" = (SELECT COALESCE(SUM(m."contributedKm"), 0) FROM "group_members" m WHERE CAST(m."group_id" AS varchar) = CAST("groups"."id" AS varchar) AND m."inactiveAt" IS NULL), "totalActivities" = (SELECT COALESCE(SUM(m."contributedActivities"), 0) FROM "group_members" m WHERE CAST(m."group_id" AS varchar) = CAST("groups"."id" AS varchar) AND m."inactiveAt" IS NULL) WHERE "inactiveAt" IS NULL',
  'UPDATE "activity_feed_posts" SET "likesCount" = (SELECT COUNT(*) FROM "feed_likes" l WHERE CAST(l."post_id" AS varchar) = CAST("activity_feed_posts"."id" AS varchar) AND l."inactiveAt" IS NULL), "commentsCount" = (SELECT COUNT(*) FROM "feed_comments" c WHERE CAST(c."post_id" AS varchar) = CAST("activity_feed_posts"."id" AS varchar) AND c."inactiveAt" IS NULL) WHERE "inactiveAt" IS NULL',
  'UPDATE "segments" SET "best_user_id" = (SELECT e."user_id" FROM "segment_efforts" e WHERE CAST(e."segment_id" AS varchar) = CAST("segments"."id" AS varchar) AND e."inactiveAt" IS NULL AND e."verified" = true ORDER BY e."elapsed_sec", e."createdAt" LIMIT 1), "bestTimeSec" = (SELECT MIN(e."elapsed_sec") FROM "segment_efforts" e WHERE CAST(e."segment_id" AS varchar) = CAST("segments"."id" AS varchar) AND e."inactiveAt" IS NULL AND e."verified" = true), "attemptsCount" = (SELECT COUNT(*) FROM "segment_efforts" e WHERE CAST(e."segment_id" AS varchar) = CAST("segments"."id" AS varchar) AND e."inactiveAt" IS NULL AND e."verified" = true) WHERE "inactiveAt" IS NULL',
];

/** Run inside the same transaction as account deactivation. No physical delete. */
export async function retainInactiveContent(manager: EntityManager): Promise<void> {
  for (const [table, links] of Object.entries(RETAINED_CONTENT)) {
    await manager.createQueryBuilder().update(table).set({ inactiveAt: new Date() })
      .where(`"inactiveAt" IS NULL AND (${retainedContentPredicate(links)})`).execute();
  }
  await manager.createQueryBuilder().update('notifications').set({ inactiveAt: new Date() })
    .where(`"inactiveAt" IS NULL AND (${INACTIVE_NOTIFICATION_SOURCE})`).execute();
  await manager.createQueryBuilder().update('refresh_tokens').set({ revoked: true })
    .where('CAST("user_id" AS varchar) IN (SELECT CAST("id" AS varchar) FROM "users" WHERE "isActive" = false OR "deletedAt" IS NOT NULL)').execute();
  for (const sql of RETENTION_SUMMARIES) await manager.query(sql);
}

export async function retainContentRemoval<T extends ObjectLiteral>(repository: Repository<T>, id: string): Promise<void> {
  await repository.manager.transaction(async manager => {
    await manager.getRepository(repository.target).softDelete(id);
    await retainInactiveContent(manager);
  });
}
