import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddGoogleSubject1789800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.addColumn('users', new TableColumn({ name: 'googleSubject', type: 'varchar', length: '255', isNullable: true }));
    await q.createIndex('users', new TableIndex({ name: 'users_google_subject_unique', columnNames: ['googleSubject'], isUnique: true }));
  }

  async down(q: QueryRunner): Promise<void> {
    await q.dropIndex('users', 'users_google_subject_unique');
    await q.dropColumn('users', 'googleSubject');
  }
}
