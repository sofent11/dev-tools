import { describe, expect, it } from 'vitest';
import { sanitizeHtmlMarkup, sanitizeSvgMarkup } from '../shared/sanitizeMarkup';

describe('sanitize markup allowlist', () => {
  it('removes dangerous HTML tags, handlers, and URL payloads', () => {
    const sanitized = sanitizeHtmlMarkup(`
      <div onclick="alert(1)" style="color: red; background-image: url(javascript:alert(1)); position: fixed">
        <script>alert(1)</script>
        <a href="javascript:alert(1)">bad</a>
        <img src="data:text/html;base64,PHNjcmlwdD4=" onerror="alert(1)">
        <strong>safe</strong>
      </div>
    `);

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
    const sanitized = sanitizeSvgMarkup(`
      <svg viewBox="0 0 10 10" onload="alert(1)">
        <foreignObject><iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"></iframe></foreignObject>
        <path d="M0 0L10 10" stroke="red" style="stroke-width: 2; background: url(javascript:alert(1))" />
        <image href="javascript:alert(1)" />
        <text>OK</text>
      </svg>
    `);

    expect(sanitized).toContain('<path');
    expect(sanitized).toContain('<text>OK</text>');
    expect(sanitized).toContain('style="stroke-width: 2"');
    expect(sanitized).not.toMatch(/foreignObject|iframe|srcdoc|onload|javascript:|<image|url\(/i);
  });

  it('rejects malformed SVG', () => {
    expect(sanitizeSvgMarkup('<svg><path></svg')).toBe('');
  });
});
