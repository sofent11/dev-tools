import type { SqlJsStatic, QueryExecResult } from 'sql.js';
export interface SqliteResult {
  snapshot: Uint8Array;
  results: QueryExecResult[];
  tables: { name: string; sql: string; columns: { name: string; type: string }[] }[];
}
export const executeSqliteTask = (SQL: SqlJsStatic, input: { snapshot?: Uint8Array; sql?: string }): SqliteResult => {
  if ((input.snapshot?.byteLength || 0) > 64 * 1024 * 1024) throw new Error('Database limit: 64 MB');
  if ((input.sql?.length || 0) > 1_000_000) throw new Error('SQL limit: 1 MB');
  const db = new SQL.Database(input.snapshot);
  try {
    if (!input.snapshot) db.run(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT, role TEXT);
      INSERT INTO users VALUES (1, 'Alice', 'alice@example.com', 'Administrator'), (2, 'Bob', 'bob@example.com', 'Developer');
      CREATE TABLE logs (id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT);
      INSERT INTO logs VALUES (1, 1, 'Login'), (2, 2, 'Git Commit');`);
    const results: QueryExecResult[] = [];
    let rows = 0;
    let bytes = 0;
    for (const statement of db.iterateStatements(input.sql || 'SELECT * FROM sqlite_master LIMIT 100')) {
      const columns = statement.getColumnNames();
      const values: QueryExecResult['values'] = [];
      while (statement.step()) {
        const row = statement.get();
        bytes += JSON.stringify(row).length;
        if (++rows > 1000 || bytes > 2_000_000) throw new Error('Result limit: 1,000 rows / 2 MB. Add LIMIT; this task was not committed.');
        values.push(row);
      }
      if (columns.length) results.push({ columns, values });
      if (results.length > 100) throw new Error('At most 100 result sets per task');
    }
    const tables = (db.exec("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 200")[0]?.values || []).map(row => {
      const name = String(row[0]);
      const columns = (db.exec(`PRAGMA table_info("${name.replace(/"/g, '""')}")`)[0]?.values || []).map(column => ({ name: String(column[1]), type: String(column[2]) }));
      return { name, sql: String(row[1]), columns };
    });
    const snapshot = db.export();
    if (snapshot.byteLength > 64 * 1024 * 1024) throw new Error('Database limit: 64 MB; task was not committed.');
    return { snapshot, results, tables };
  } finally { db.close(); }
};
