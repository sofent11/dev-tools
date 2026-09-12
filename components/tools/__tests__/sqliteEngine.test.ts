import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { executeSqliteTask } from '../data/sqliteEngine';
let SQL: SqlJsStatic;
beforeAll(async () => { SQL = await initSqlJs({ wasmBinary: readFileSync('node_modules/sql.js/dist/sql-wasm.wasm') }); });
describe('SQLite result and checkpoint semantics', () => {
  it('executes real SQL and preserves a committed database across worker tasks', () => {
    const first = executeSqliteTask(SQL, { sql: "INSERT INTO users VALUES (3,'Ada','ada@example.com','Developer'); SELECT COUNT(*) AS count FROM users;" });
    expect(first.results[0].values).toEqual([[3]]);
    const second = executeSqliteTask(SQL, { snapshot: first.snapshot, sql: 'SELECT name FROM users WHERE id=3;' });
    expect(second.results[0].values).toEqual([['Ada']]);
  });
  it('retains the original checkpoint when an operation exceeds its output budget', () => {
    const first = executeSqliteTask(SQL, {});
    expect(() => executeSqliteTask(SQL, { snapshot: first.snapshot, sql: "DELETE FROM users; WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1002) SELECT x FROM n;" })).toThrow('1,000');
    const result = executeSqliteTask(SQL, { snapshot: first.snapshot, sql: 'SELECT COUNT(*) FROM users;' });
    expect(result.results[0].values).toEqual([[2]]);
  });
});
