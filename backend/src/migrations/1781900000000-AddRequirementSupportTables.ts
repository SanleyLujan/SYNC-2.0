import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema usado pelas implementações dos RF05, RF07, RF23, RF36 e RF40.
 * Idempotente para permitir o primeiro deploy com DB_SYNCHRONIZE=true e a
 * migração posterior para DB_SYNCHRONIZE=false.
 */
export class AddRequirementSupportTables1781900000000 implements MigrationInterface {
  name = 'AddRequirementSupportTables1781900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hobbies" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isProfileVisible" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "showLocation" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "feedback" ADD COLUMN IF NOT EXISTS "protocol" character varying(24)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "group_join_requests" (
        "id" uuid NOT NULL,
        "group_id" character varying NOT NULL,
        "user_id" character varying NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_join_requests_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_join_requests_group_user" UNIQUE ("group_id", "user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_group_join_requests_group_status" ON "group_join_requests" ("group_id", "status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "subscription_transactions" (
        "id" uuid NOT NULL,
        "user_id" character varying NOT NULL,
        "tier" character varying(20) NOT NULL,
        "amountCents" integer NOT NULL,
        "status" character varying(16) NOT NULL DEFAULT 'pending',
        "paidAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscription_transactions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_subscription_transactions_user_created" ON "subscription_transactions" ("user_id", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "subscription_transactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "group_join_requests"`);
    await queryRunner.query(`ALTER TABLE "feedback" DROP COLUMN IF EXISTS "protocol"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "showLocation"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isProfileVisible"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "hobbies"`);
  }
}
