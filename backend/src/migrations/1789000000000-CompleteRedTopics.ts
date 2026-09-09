import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompleteRedTopics1789000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (q.connection.options.type !== 'postgres') return;
    await q.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS "territoryProcessed" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS "territoryOptIn" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS "segmentsOptIn" boolean NOT NULL DEFAULT false`);
    await q.query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS "plannedRoute" text`);
    await q.query(`ALTER TABLE territory_cells ADD COLUMN IF NOT EXISTS "capturedAt" bigint NOT NULL DEFAULT 0`);
    await q.query(`ALTER TABLE segments ADD COLUMN IF NOT EXISTS geometry text`);
    await q.query(`ALTER TABLE segment_efforts ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false`);
    // Preserve legacy manual records for history, but exclude them from competitive rankings.
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS segment_verified_activity_unique ON segment_efforts(segment_id, activity_id) WHERE verified = true`);
    await q.query(`ALTER TABLE user_achievements ADD COLUMN IF NOT EXISTS "claimKey" varchar(120)`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS achievement_claim_unique ON user_achievements("claimKey")`);
  }
  async down(): Promise<void> { /* Additive migration: do not erase activity routes or history. */ }
}
