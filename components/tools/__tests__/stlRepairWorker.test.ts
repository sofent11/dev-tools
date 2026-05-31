import { describe, expect, it } from 'vitest';
import { serializeBinaryStl } from '../StlRepair/stlRepair.worker';

describe('STL repair worker helpers', () => {
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
