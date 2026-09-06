import { MigrationInterface, QueryRunner } from 'typeorm';

/** Registra pausas para calcular somente a duração ativa do treino. */
export class AddActivityPauseTiming1782200000000 implements MigrationInterface {
  name = 'AddActivityPauseTiming1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "pausedDuration" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "activity_points" ADD COLUMN IF NOT EXISTS "segmentStart" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "activity_points" DROP COLUMN IF EXISTS "segmentStart"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "pausedDuration"`);
    await queryRunner.query(`ALTER TABLE "activities" DROP COLUMN IF EXISTS "pausedAt"`);
  }
}
