import { MigrationInterface, QueryRunner } from 'typeorm';

export class Gamification1788900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gamificationStartedAt" timestamp NOT NULL DEFAULT now()`);
    await q.query(`ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "acceptedAt" timestamp`);
    await q.query(`ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "ruleVersion" integer NOT NULL DEFAULT 0`);
    // Legacy challenges allowed arbitrary targets and manual wins: never retro-award XP.
    await q.query(`UPDATE "challenges" SET "status"='expired' WHERE "ruleVersion"=0 AND "status" IN ('pending','accepted')`);
    await q.query(`ALTER TABLE "challenges" ALTER COLUMN "ruleVersion" SET DEFAULT 1`);
    await q.query(`CREATE TABLE IF NOT EXISTS "gamification_rewards" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "source" varchar(120) NOT NULL, "day" varchar(10) NOT NULL, "xp" integer NOT NULL DEFAULT 0 CHECK ("xp">=0 AND "xp"<=100),
      "data" text, "createdAt" timestamp NOT NULL DEFAULT now(), UNIQUE ("user_id", "source")
    )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_gamification_day" ON "gamification_rewards" ("user_id","day")`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_challenges_expiry" ON "challenges" ("status","expiresAt")`);
    // Supabase direct clients must not read/write the ledger; backend uses its DB role.
    await q.query(`ALTER TABLE "gamification_rewards" ENABLE ROW LEVEL SECURITY`);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "gamification_rewards"`);
    await q.query(`ALTER TABLE "challenges" DROP COLUMN IF EXISTS "acceptedAt", DROP COLUMN IF EXISTS "ruleVersion"`);
    await q.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "gamificationStartedAt"`);
  }
}
