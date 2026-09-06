import { MigrationInterface, QueryRunner } from 'typeorm';

/** Metas e métricas persistidas sem criar uma tabela nova. */
export class AddActivityGoalsAndMetrics1782300000000 implements MigrationInterface {
  name = 'AddActivityGoalsAndMetrics1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "goalType" varchar(20)`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "goalValue" integer`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "goalReachedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "calories" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "elevationGain" real NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "laps" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "laps"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "elevationGain"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "calories"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "goalReachedAt"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "goalValue"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "goalType"`);
  }
}
