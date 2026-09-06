import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPreferencesAndAdmin1782400000000 implements MigrationInterface {
  name = 'AddUserPreferencesAndAdmin1782400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isAdmin" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pushNotificationsEnabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "emailNotificationsEnabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inAppNotificationsEnabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "themeMode" varchar(10) NOT NULL DEFAULT 'dark'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "themeMode"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "inAppNotificationsEnabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "emailNotificationsEnabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "pushNotificationsEnabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isAdmin"`);
  }
}
