import { describe, expect, it, vi, afterEach } from 'vitest';
import { generateJsonSchema, validateJsonSchema } from '../data/jsonSchema';
import { uniqueArchiveName } from '../shared/archive';
import { runWorkerTask } from '../shared/workerTask';
import { assertPublicUrl, boundedFetch } from '../../../workers/video-catch-worker';
import worker from '../../../workers/video-catch-worker';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('schema semantics', () => {
  it.each([
    [{ type: 'number', minimum: 10 }, 3], [{ enum: ['a'] }, 'b'],
    [{ type: 'string', pattern: '^A' }, 'bee'], [{ type: 'string', format: 'email' }, 'invalid'],
    [{ type: 'object', additionalProperties: false }, { extra: 1 }],
    [{ oneOf: [{ type: 'string' }, { type: 'number' }] }, false],
    [false, 1], [{ mysteryKeyword: true }, 1],
  ])('rejects unsupported or violated constraints: %j', (schema, data) => expect(validateJsonSchema(schema, data).length).toBeGreaterThan(0));
  it('accepts mixed arrays and preserves special property names in generated schemas', () => {
    const data = JSON.parse('{"__proto__":[1,"a",null,{"x":true}]}');
    const schema = generateJsonSchema(data);
    expect(Object.hasOwn(schema.properties as object, '__proto__')).toBe(true);
    expect(validateJsonSchema(schema, data)).toEqual([]);
  });
});
describe('archives and task cancellation', () => {
  it('keeps all sanitized names unique, including case collisions', () => {
    const used = new Set<string>();
    expect(['a/b.txt', 'c/b.txt', 'B.txt', '../'].map(name => uniqueArchiveName(name, used))).toEqual(['b.txt', 'b (2).txt', 'B (3).txt', 'item.txt']);
  });
  it('terminates a stalled worker and rejects within the task budget', async () => {
    vi.useFakeTimers();
    const worker = { postMessage: vi.fn(), terminate: vi.fn() } as unknown as Worker;
    const result = runWorkerTask(worker, {}, { timeoutMs: 100 });
    const check = expect(result).rejects.toThrow('time budget');
    await vi.advanceTimersByTimeAsync(100);
    await check;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('does not dispatch an already cancelled task', async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn() } as unknown as Worker;
    const controller = new AbortController(); controller.abort();
    await expect(runWorkerTask(worker, {}, { signal: controller.signal })).rejects.toThrow('cancelled');
    expect(worker.postMessage).not.toHaveBeenCalled();
  });
});
describe('video worker request boundaries', () => {
  it.each(['file:///etc/passwd','http://127.1/','http://2130706433/','http://10.0.0.1/','http://169.254.169.254/','http://[::1]/','https://user:pass@example.com/'])('rejects non-public target %s', url => expect(() => assertPublicUrl(url)).toThrow());
  it('checks redirect destinations before following them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/' } })));
    await expect(boundedFetch('https://example.com/')).rejects.toThrow('Private');
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('enforces a streaming body budget without trusting content-length', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(4 * 1024 * 1024 + 1))));
    await expect(boundedFetch('https://example.com/')).rejects.toThrow('size budget');
  });
  it('requires the configured token before parsing any target', async () => {
    const response = await worker.fetch(new Request('https://worker.example/api/extract?url=https://example.com/'), { ACCESS_TOKEN: 'test-token' });
    expect(response.status).toBe(401);
  });
});
