import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readFixture = (name: string) =>
  readFileSync(join(process.cwd(), 'components/tools/__fixtures__', name), 'utf8');

describe('tool fixture inventory', () => {
  it('keeps representative local fixtures for high-risk tool families', () => {
    expect(readFixture('malicious-fragment.html')).toContain('<script>');
    expect(readFixture('malicious-vector.svg')).toContain('<foreignObject>');
    expect(readFixture('video-page.html')).toContain('video-720p.mp4');
    expect(readFixture('invalid-private-key.asc')).toContain('PGP PRIVATE KEY BLOCK');
    expect(readFixture('tiny.pdf')).toContain('%PDF-1.1');
    expect(readFixture('tetrahedron-ascii.stl')).toContain('solid tetrahedron');
  });
});
