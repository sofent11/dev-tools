import { describe, expect, it } from 'vitest';
import { parseCurlCommand } from '../NetworkTools';

describe('parseCurlCommand', () => {
  it('imports repeated data and explicit headers', () => {
    const parsed = parseCurlCommand(String.raw`curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -H 'X-Trace: abc' -d '{"name":"Ada"}'`);

    expect(parsed.method).toBe('POST');
    expect(parsed.url).toBe('https://api.example.com/users');
    expect(JSON.parse(parsed.headers)).toEqual({
      'Content-Type': 'application/json',
      'X-Trace': 'abc',
    });
    expect(parsed.body).toBe('{"name":"Ada"}');
    expect(parsed.bodyMode).toBe('raw');
  });

  it('supports --url, -G, data-urlencode, basic auth, and form fields', () => {
    const parsed = parseCurlCommand(String.raw`curl --url https://api.example.com/search -G --data-urlencode 'q=a b' -u 'user:pass' -F 'file=@demo.png' -F 'kind=image'`);

    expect(parsed.method).toBe('POST');
    expect(parsed.url).toBe('https://api.example.com/search?q=a+b');
    expect(JSON.parse(parsed.headers).Authorization).toBe('Basic dXNlcjpwYXNz');
    expect(parsed.bodyMode).toBe('form-data');
    expect(parsed.body).toContain('file=@demo.png');
    expect(parsed.body).toContain('kind=image');
  });
});
