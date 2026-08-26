import { MigrationInterface, QueryRunner } from 'typeorm';

export class HardenSupabasePublicSchema1781800000000 implements MigrationInterface {
  name = 'HardenSupabasePublicSchema1781800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    await queryRunner.query(`
      DO $$
      DECLARE
        table_record record;
      BEGIN
        FOR table_record IN
          SELECT schemaname, tablename
          FROM pg_tables
          WHERE schemaname = 'public'
        LOOP
          EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            table_record.schemaname,
            table_record.tablename
          );
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
          REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
          REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon;
          REVOKE ALL PRIVILEGES ON SCHEMA public FROM anon;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
        END IF;

        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated;
          REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
          REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;
          REVOKE ALL PRIVILEGES ON SCHEMA public FROM authenticated;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }

    // Intentionally keep the hardened posture when reverting application code.
    // Re-opening Supabase API access should be a deliberate DBA action with
    // table-specific RLS policies, not an automatic migration rollback.
  }
}
