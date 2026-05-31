import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __runtimeAssetLoaderTestUtils, loadRuntimeAsset } from '../shared/runtimeAssetLoader';

describe('runtime asset loader', () => {
  beforeEach(() => {
    __runtimeAssetLoaderTestUtils.clearCaches();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('emits loading and ready states for scripts', async () => {
    const states: string[] = [];
    const appendChild = vi.spyOn(document.head, 'appendChild');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('window.__runtimeLoaderTest = true;', {
      status: 200,
      headers: { 'content-length': '34' },
    })));
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:runtime-loader-test'),
      revokeObjectURL: vi.fn(),
    });

    appendChild.mockImplementation((node: Node) => {
      const script = node as HTMLScriptElement;
      window.setTimeout(() => {
        (0, eval)('window.__runtimeLoaderTest = true;');
        script.onload?.(new Event('load'));
      }, 0);
      return node;
    });

    await loadRuntimeAsset<void>({
      url: 'https://cdn.example.com/runtime-loader-test.js',
      kind: 'script',
      label: 'Test Runtime',
      cache: false,
      retries: 0,
      onState: state => states.push(state.status),
    });

    expect((window as unknown as { __runtimeLoaderTest: boolean }).__runtimeLoaderTest).toBe(true);
    expect(states).toContain('loading');
    expect(states).toContain('ready');
  });

  it('emits error state for failed script responses', async () => {
    const states: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', {
      status: 404,
      statusText: 'Not Found',
    })));

    await expect(loadRuntimeAsset<void>({
      url: 'https://cdn.example.com/missing.js',
      kind: 'script',
      label: 'Missing Runtime',
      cache: false,
      retries: 0,
      onState: state => states.push(state.status),
    })).rejects.toThrow('HTTP 404');

    expect(states).toContain('loading');
    expect(states).toContain('error');
  });

  it('returns cached script responses without fetching', async () => {
    const states: string[] = [];
    const appendChild = vi.spyOn(document.head, 'appendChild');
    const cacheStore = new Map<string, Response>([
      ['https://cdn.example.com/cached.js', new Response('window.__runtimeCachedTest = true;', { status: 200 })],
    ]);
    vi.stubGlobal('caches', {
      open: vi.fn(async () => ({
        match: vi.fn(async (url: string) => cacheStore.get(url)),
        put: vi.fn(async () => undefined),
      })),
    });
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:runtime-loader-cached-test'),
      revokeObjectURL: vi.fn(),
    });
    appendChild.mockImplementation((node: Node) => {
      const script = node as HTMLScriptElement;
      window.setTimeout(() => script.onload?.(new Event('load')), 0);
      return node;
    });

    await loadRuntimeAsset<void>({
      url: 'https://cdn.example.com/cached.js',
      kind: 'script',
      label: 'Cached Runtime',
      cache: true,
      retries: 0,
      onState: state => states.push(state.status),
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(states).toContain('cached');
    expect(states).toContain('ready');
  });

  it('clears module timeout after success', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    const module = await __runtimeAssetLoaderTestUtils.withRuntimeTimeout(Promise.resolve({ ok: true }), 1000, 'Module Runtime');
    expect(module).toEqual({ ok: true });
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('falls back to secondary asset URLs after a primary failure', async () => {
    const states: Array<{ status: string; activeUrl?: string }> = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('missing', { status: 404, statusText: 'Not Found' }))
      .mockResolvedValueOnce(new Response('fallback-ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await loadRuntimeAsset<Response>({
      url: 'https://cdn.example.com/primary.bin',
      fallbackUrls: ['https://static.example.com/fallback.bin'],
      kind: 'asset',
      label: 'Fallback Asset',
      cache: false,
      retries: 0,
      onState: state => states.push({ status: state.status, activeUrl: state.activeUrl }),
    });

    expect(await response.text()).toBe('fallback-ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(states).toContainEqual(expect.objectContaining({
      status: 'ready',
      activeUrl: 'https://static.example.com/fallback.bin',
    }));
  });

  it('rejects assets when SHA-256 verification fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('tampered', { status: 200 })));

    await expect(loadRuntimeAsset<Response>({
      url: 'https://cdn.example.com/tampered.bin',
      kind: 'asset',
      label: 'Verified Asset',
      cache: false,
      retries: 0,
      expectedSha256: '0'.repeat(64),
    })).rejects.toThrow('资源完整性校验失败');
  });
});
