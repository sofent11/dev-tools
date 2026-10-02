import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { executeSqliteTask } from './sqliteEngine';
self.onmessage = async (event: MessageEvent<{ snapshot?: Uint8Array; sql?: string }>) => {
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    self.postMessage({ result: executeSqliteTask(SQL, event.data) });
  } catch (error) { self.postMessage({ error: (error as Error).message }); }
};
