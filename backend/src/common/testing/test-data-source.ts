import { DataSource } from 'typeorm';
import * as path from 'path';

/** Node 22+ SQLite adapter for tests when the optional native addon is absent. */
export async function testDataSource(): Promise<DataSource> {
  let driver: any;
  try {
    const { DatabaseSync } = require('node:sqlite');
    driver = class {
      db: any;
      constructor(file: string) { this.db = new DatabaseSync(file); }
      pragma(sql: string) { return this.db.prepare('PRAGMA ' + sql).all(); }
      prepare(sql: string) {
        const statement = this.db.prepare(sql);
        return { reader: statement.columns().length > 0,
          all: (...params: any[]) => statement.all(...params),
          run: (...params: any[]) => statement.run(...params) };
      }
      close() { this.db.close(); }
    };
  } catch { driver = require('better-sqlite3'); }
  return new DataSource({ type: 'better-sqlite3', driver, database: ':memory:',
    synchronize: true, entities: [path.join(__dirname, '../../**/*.entity.ts')] }).initialize();
}
