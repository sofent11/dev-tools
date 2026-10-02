const DB_NAME = 'devtoolbox-scratchpad-db';
const STORE_NAME = 'entries';
let opening: Promise<IDBDatabase> | undefined;
const openDb = (): Promise<IDBDatabase> => {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => { opening = undefined; reject(request.error || new Error('Cannot open scratchpad')); };
    request.onblocked = () => { opening = undefined; reject(new Error('Close other toolbox tabs to update storage')); };
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = undefined; };
      db.onclose = () => { opening = undefined; };
      resolve(db);
    };
  });
  return opening;
};
const write = async (operation: (store: IDBObjectStore) => void): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error('Scratchpad transaction aborted'));
    transaction.onerror = () => reject(transaction.error || new Error('Scratchpad transaction failed'));
    operation(transaction.objectStore(STORE_NAME));
  });
};
export const saveEntity = (id: string, content: string | Blob | ArrayBuffer) => write(store => { store.put(content, id); });
export const deleteEntity = (id: string) => write(store => { store.delete(id); });
export const clearEntities = () => write(store => { store.clear(); });
export const getEntity = async (id: string): Promise<string | Blob | ArrayBuffer> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    transaction.onabort = () => reject(transaction.error || new Error('Scratchpad read aborted'));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => request.result === undefined
      ? reject(new Error(`Scratchpad content is missing: ${id}`)) : resolve(request.result);
  });
};
