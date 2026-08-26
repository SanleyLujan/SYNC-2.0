import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Privacidade: usuários só aparecem no mapa depois de optarem por isso.
 * A posição exibida no mapa continua aproximada; a coordenada real fica
 * disponível apenas para cálculos internos de distância, eventos e rotas.
 */
export class MakeLocationPrivateByDefault1782000000000 implements MigrationInterface {
  name = 'MakeLocationPrivateByDefault1782000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "showLocation" SET DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE "users" SET "showLocation" = false WHERE "showLocation" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "showLocation" SET DEFAULT true`,
    );
  }
}
