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

const { saveEntity } = await import('../shared/scratchpadDb');
const { useScratchpadStore } = await import('../shared/scratchpadStore');

describe('scratchpad store degraded persistence', () => {
  beforeEach(() => {
    useScratchpadStore.setState({ items: [], storageStatus: 'ok', lastStorageError: undefined });
    vi.mocked(saveEntity).mockReset();
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
});
