import { describe, expect, it } from 'vitest';
import { buildDiff, generateJsonPatch, toJsonPointer } from '../DataTools';

describe('JSON diff path handling', () => {
  it('escapes JSON Pointer segments for special object keys', () => {
    expect(toJsonPointer(['a.b', 'x/y', 'tilde~key', 0])).toBe('/a.b/x~1y/tilde~0key/0');
  });

  it('generates valid patch paths for keys with dots, brackets, slash, and tilde', () => {
    const diff = buildDiff(
      { 'a.b': { 'x/y': 1 }, list: ['a', 'b'], 'tilde~key': true },
      { 'a.b': { 'x/y': 2 }, list: ['a'], 'tilde~key': false },
    );

    expect(generateJsonPatch(diff)).toEqual([
      { op: 'remove', path: '/list/1' },
      { op: 'replace', path: '/a.b/x~1y', value: 2 },
      { op: 'replace', path: '/tilde~0key', value: false },
    ]);
  });
});
