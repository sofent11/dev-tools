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

const { saveEntity, getEntity } = await import('../shared/scratchpadDb');
const { useScratchpadStore, getScratchpadItemContent } = await import('../shared/scratchpadStore');

describe('scratchpad store degraded persistence', () => {
  it('propagates missing binary content instead of exporting an empty file', async () => {
    vi.mocked(getEntity).mockRejectedValueOnce(new Error('missing content'));
    await expect(getScratchpadItemContent({ id: 'missing', name: 'missing.bin', type: 'binary', content: '', isBinary: true, size: 10, timestamp: 1 })).rejects.toThrow('missing content');
  });
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

  it('rejects a save when metadata persistence is unavailable', async () => {
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => { throw new Error('metadata quota'); }).mockImplementationOnce(() => { throw new Error('metadata quota'); });
    await expect(useScratchpadStore.getState().addItemAsync('note', 'text')).rejects.toThrow('metadata quota');
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

    expect(saveEntity).not.toHaveBeenCalled();
    expect(await getScratchpadItemContent(useScratchpadStore.getState().items[0])).toBe('secret-key');
    expect(JSON.stringify(vi.mocked(localStorage.setItem).mock.calls.at(-1))).not.toContain('secret-key');
    expect(useScratchpadStore.getState().items[0]).toMatchObject({
      sourceTool: 'PGP',
      sensitive: true,
      originAction: 'generate-key',
    });
  });
});
