const DB_NAME = 'devtoolbox-scratchpad-db';
const STORE_NAME = 'entries';
const METADATA_STORE_NAME = 'metadata';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open scratchpad IndexedDB'));
    };

    request.onblocked = () => {
      reject(new Error('Scratchpad IndexedDB upgrade is blocked by another open tab'));
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
        db.createObjectStore(METADATA_STORE_NAME);
      }
      request.transaction
        ?.objectStore(METADATA_STORE_NAME)
        .put({ version: DB_VERSION, updatedAt: Date.now() }, 'schema');
    };
  });
};

export const saveEntity = async (id: string, content: string | Blob | ArrayBuffer): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(content, id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to save scratchpad item with ID: ${id}`));
  });
};

export const getEntity = async (id: string): Promise<string | Blob | ArrayBuffer> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (request.result !== undefined) {
        resolve(request.result);
      } else {
        reject(new Error(`Scratchpad item not found in IndexedDB: ${id}`));
      }
    };
    request.onerror = () => reject(new Error(`Failed to fetch scratchpad item with ID: ${id}`));
  });
};

export const deleteEntity = async (id: string): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error(`Failed to delete scratchpad item with ID: ${id}`));
  });
};

export const clearEntities = async (): Promise<void> => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Failed to clear scratchpad IndexedDB store'));
  });
};
