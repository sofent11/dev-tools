import { describe, expect, it, vi } from 'vitest';
import { loadRuntimeAsset } from '../shared/runtimeAssetLoader';

describe('runtime asset loader', () => {
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
    appendChild.mockRestore();
  });
});
