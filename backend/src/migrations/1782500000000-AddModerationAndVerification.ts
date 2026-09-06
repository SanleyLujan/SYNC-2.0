import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddModerationAndVerification1782500000000 implements MigrationInterface {
  name = 'AddModerationAndVerification1782500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`ALTER TABLE "user_reports" ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'pending'`);
    await queryRunner.query(`ALTER TABLE "user_reports" ADD COLUMN IF NOT EXISTS "reviewed_by" varchar`);
    await queryRunner.query(`ALTER TABLE "user_reports" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_user_reports_status_created" ON "user_reports" ("status", "createdAt")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "post_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reporter_id" uuid NOT NULL,
        "post_id" uuid NOT NULL,
        "reason" varchar NOT NULL,
        "description" text,
        "status" varchar NOT NULL DEFAULT 'pending',
        "reviewed_by" varchar,
        "reviewedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_post_reports" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_post_reports_reporter_post" UNIQUE ("reporter_id", "post_id"),
        CONSTRAINT "FK_post_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_post_reports_post" FOREIGN KEY ("post_id") REFERENCES "activity_feed_posts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_post_reports_status_created" ON "post_reports" ("status", "createdAt")`);

    await queryRunner.query(`ALTER TABLE "feed_comments" ADD COLUMN IF NOT EXISTS "mentioned_user_ids" text`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "feed_comment_reactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "comment_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "emoji" varchar(12) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_feed_comment_reactions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_feed_comment_reactions_comment_user_emoji" UNIQUE ("comment_id", "user_id", "emoji"),
        CONSTRAINT "FK_feed_comment_reactions_comment" FOREIGN KEY ("comment_id") REFERENCES "feed_comments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_feed_comment_reactions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_feed_comment_reactions_comment" ON "feed_comment_reactions" ("comment_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "verification_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "selfieKey" text,
        "documentFrontKey" text,
        "documentBackKey" text,
        "status" varchar NOT NULL DEFAULT 'pending',
        "reviewed_by" varchar,
        "rejectionReason" text,
        "reviewedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_verification_requests" PRIMARY KEY ("id"),
        CONSTRAINT "FK_verification_requests_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_verification_status_created" ON "verification_requests" ("status", "createdAt")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_verification_one_pending_per_user" ON "verification_requests" ("user_id") WHERE "status" = 'pending'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_verification_one_pending_per_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verification_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "feed_comment_reactions"`);
    await queryRunner.query(`ALTER TABLE "feed_comments" DROP COLUMN IF EXISTS "mentioned_user_ids"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "post_reports"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_reports_status_created"`);
    await queryRunner.query(`ALTER TABLE "user_reports" DROP COLUMN IF EXISTS "reviewedAt"`);
    await queryRunner.query(`ALTER TABLE "user_reports" DROP COLUMN IF EXISTS "reviewed_by"`);
    await queryRunner.query(`ALTER TABLE "user_reports" DROP COLUMN IF EXISTS "status"`);
  }
}
