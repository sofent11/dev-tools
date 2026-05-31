import { describe, expect, it, vi } from 'vitest';
import { buildPasswordCharset, generateUnbiasedPassword } from '../SecurityTools';

describe('password generator', () => {
  it('protects against empty character sets', () => {
    expect(buildPasswordCharset({
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false,
    })).toBe('');
    expect(generateUnbiasedPassword(12, {
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false,
    })).toBe('');
  });

  it('uses rejection sampling for unbiased output', () => {
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues');
    getRandomValues
      .mockImplementationOnce((array: ArrayBufferView | null) => {
        (array as Uint32Array)[0] = 0xffffffff;
        return array!;
      })
      .mockImplementation((array: ArrayBufferView | null) => {
        (array as Uint32Array)[0] = 0;
        return array!;
      });

    expect(generateUnbiasedPassword(1, {
      uppercase: true,
      lowercase: false,
      numbers: false,
      symbols: false,
    })).toBe('A');
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });
});
