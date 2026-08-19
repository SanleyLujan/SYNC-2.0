import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEmailVerification1781600000000 implements MigrationInterface {
  name = 'AddEmailVerification1781600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "emailVerified" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "emailVerificationToken" character varying
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMP
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_email_verification_token"
      ON "users" ("emailVerificationToken")
      WHERE "emailVerificationToken" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email_verification_token"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationExpires"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerificationToken"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerified"`);
  }
}
