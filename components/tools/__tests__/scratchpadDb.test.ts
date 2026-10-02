import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
beforeEach(() => { vi.resetModules(); vi.stubGlobal('indexedDB', new IDBFactory()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('scratchpad durable transactions', () => {
  it('round-trips binary content and reports missing content after deletion', async () => {
    const db = await import('../shared/scratchpadDb');
    const buffer = new Uint8Array([1,2,3]).buffer;
    await db.saveEntity('binary', buffer);
    expect(new Uint8Array(await db.getEntity('binary') as ArrayBuffer)).toEqual(new Uint8Array([1,2,3]));
    await db.deleteEntity('binary');
    await expect(db.getEntity('binary')).rejects.toThrow('missing');
  });
  it('rejects a transaction aborted after the write request succeeds', async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    const db = await import('../shared/scratchpadDb');
    await expect(db.saveEntity('aborted', 'value')).rejects.toThrow('aborted');
    await expect(db.getEntity('aborted')).rejects.toThrow('missing');
  });
});
