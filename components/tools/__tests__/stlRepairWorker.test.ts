import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serializeBinaryStl } from '../StlRepair/stlRepair.worker';

const readFixture = (name: string) =>
  readFileSync(join(process.cwd(), 'components/tools/__fixtures__', name), 'utf8');

describe('STL repair worker helpers', () => {
  it('keeps a checked-in ASCII STL fixture for geometry regressions', () => {
    const fixture = readFixture('tetrahedron-ascii.stl');
    expect(fixture).toContain('solid tetrahedron');
    expect(fixture.match(/facet normal/g)).toHaveLength(2);
  });

  it('serializes a binary STL with the correct triangle count', () => {
    const positions = new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
    const indices = new Uint32Array([
      0, 1, 2,
      0, 2, 3,
    ]);

    const buffer = serializeBinaryStl({ positions, indices }, 'fixture.stl');
    const view = new DataView(buffer);

    expect(buffer.byteLength).toBe(84 + 2 * 50);
    expect(view.getUint32(80, true)).toBe(2);
  });
});
