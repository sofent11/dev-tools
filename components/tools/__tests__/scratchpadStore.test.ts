import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../shared/scratchpadDb', () => ({
  saveEntity: vi.fn(),
  deleteEntity: vi.fn(),
  getEntity: vi.fn(),
  clearEntities: vi.fn(),
}));

vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
});

const { saveEntity, deleteEntity } = await import('../shared/scratchpadDb');
const { useScratchpadStore } = await import('../shared/scratchpadStore');

describe('scratchpad store degraded persistence', () => {
  beforeEach(() => {
    useScratchpadStore.setState({ items: [], storageStatus: 'ok', lastStorageError: undefined });
    vi.mocked(saveEntity).mockReset();
    vi.mocked(deleteEntity).mockReset();
    vi.mocked(deleteEntity).mockResolvedValue(undefined);
  });

  it('keeps small text items in metadata when IndexedDB save fails', async () => {
    vi.mocked(saveEntity).mockRejectedValueOnce(new Error('quota exceeded'));

    await useScratchpadStore.getState().addItemAsync('note.txt', 'hello', 'text', 'text/plain');

    const state = useScratchpadStore.getState();
    expect(state.storageStatus).toBe('degraded');
    expect(state.lastStorageError).toContain('quota exceeded');
    expect(state.items[0]).toMatchObject({ name: 'note.txt', content: 'hello', isBinary: false });
  });

  it('throws for binary items when IndexedDB save fails', async () => {
    vi.mocked(saveEntity).mockRejectedValueOnce(new Error('indexeddb blocked'));

    await expect(useScratchpadStore.getState().addItemAsync(
      'payload.bin',
      new Blob(['binary'], { type: 'application/octet-stream' }),
      'binary',
      'application/octet-stream',
    )).rejects.toThrow('暂存箱存储失败');

    expect(useScratchpadStore.getState().storageStatus).toBe('error');
    expect(useScratchpadStore.getState().items).toHaveLength(0);
  });

  it('preserves source, sensitive, and origin metadata', async () => {
    vi.mocked(saveEntity).mockResolvedValueOnce(undefined);

    await useScratchpadStore.getState().addItemAsync({
      name: 'private.pem',
      content: 'secret-key',
      type: 'text',
      mimeType: 'text/plain',
      sourceTool: 'PGP',
      sensitive: true,
      originAction: 'generate-key',
    });

    expect(useScratchpadStore.getState().items[0]).toMatchObject({
      sourceTool: 'PGP',
      sensitive: true,
      originAction: 'generate-key',
    });
    expect(useScratchpadStore.getState().items[0].expiresAt).toBeGreaterThan(Date.now());
  });

  it('prunes expired sensitive items and deletes persisted entities', () => {
    const expiredAt = Date.now() - 1000;
    useScratchpadStore.setState({
      items: [
        {
          id: 'expired',
          name: 'old-private.pem',
          content: '',
          type: 'text',
          timestamp: expiredAt - 1000,
          size: 10,
          sensitive: true,
          expiresAt: expiredAt,
        },
        {
          id: 'fresh',
          name: 'fresh.txt',
          content: 'fresh',
          type: 'text',
          timestamp: Date.now(),
          size: 5,
        },
      ],
      storageStatus: 'ok',
      lastStorageError: undefined,
    });

    useScratchpadStore.getState().pruneExpiredItems();

    expect(useScratchpadStore.getState().items.map(item => item.id)).toEqual(['fresh']);
    expect(deleteEntity).toHaveBeenCalledWith('expired');
  });
});
