import { readFileSync } from 'fs';
import { join } from 'path';
import { RetainInactiveAccountsAndLikeDecisions1790553600000 } from '../migrations/1790553600000-RetainInactiveAccountsAndLikeDecisions';

it('keeps the manual PostgreSQL script identical to the application migration', async () => {
  const statements: string[] = [];
  await new RetainInactiveAccountsAndLikeDecisions1790553600000().up({
    query: async (sql: string) => { statements.push(sql); },
  } as any);
  const manual = readFileSync(join(__dirname, '../../sql/2026-09-28-likes-e-contas-inativas.sql'), 'utf8')
    .replace(/^--.*$/gm, '').split(';').map(sql => sql.trim()).filter(sql => sql && sql !== 'BEGIN' && sql !== 'COMMIT');
  expect(statements).toEqual(manual);
  expect(statements).not.toContainEqual(expect.stringMatching(/DELETE FROM|DROP TABLE/));
});
