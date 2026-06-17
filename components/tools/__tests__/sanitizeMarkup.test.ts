import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeHtmlMarkup, sanitizeSvgMarkup } from '../shared/sanitizeMarkup';

const readFixture = (name: string) =>
  readFileSync(join(process.cwd(), 'components/tools/__fixtures__', name), 'utf8');

describe('sanitize markup allowlist', () => {
  it('removes dangerous HTML tags, handlers, and URL payloads', () => {
    const sanitized = sanitizeHtmlMarkup(readFixture('malicious-fragment.html'));

    expect(sanitized).toContain('<strong>safe</strong>');
    expect(sanitized).toContain('style="color: red"');
    expect(sanitized).not.toMatch(/script|onclick|onerror|javascript:|data:text\/html|background-image|position/i);
  });

  it('drops dangerous containers with their nested content', () => {
    const html = sanitizeHtmlMarkup('<p>safe</p><script><strong>nope</strong></script><iframe><em>bad</em></iframe>');
    const svg = sanitizeSvgMarkup('<svg viewBox="0 0 10 10"><foreignObject><text>bad</text></foreignObject><text>ok</text></svg>');

    expect(html).toContain('<p>safe</p>');
    expect(html).not.toMatch(/nope|bad|script|iframe/i);
    expect(svg).toContain('<text>ok</text>');
    expect(svg).not.toMatch(/foreignObject|bad/i);
  });

  it('keeps a safe SVG subset and strips active content', () => {
    const sanitized = sanitizeSvgMarkup(readFixture('malicious-vector.svg'));

    expect(sanitized).toContain('<path');
    expect(sanitized).toContain('<text>OK</text>');
    expect(sanitized).toContain('style="stroke-width: 2"');
    expect(sanitized).not.toMatch(/foreignObject|iframe|srcdoc|onload|javascript:|<image|url\(/i);
  });

  it('rejects malformed SVG', () => {
    expect(sanitizeSvgMarkup('<svg><path></svg')).toBe('');
  });
});
