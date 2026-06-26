import { describe, expect, it } from 'vitest';
import {
  calculateCompatibility,
  calculateLifePath,
  calculateNameReading,
  calculatePersonalYear,
  letterValue,
  reduceNumber,
} from '../arithmancy/arithmancyCore';

describe('arithmancy core calculations', () => {
  it('maps letters through the A=1 to I=9 cycle', () => {
    expect(letterValue('A')).toBe(1);
    expect(letterValue('I')).toBe(9);
    expect(letterValue('J')).toBe(1);
    expect(letterValue('R')).toBe(9);
    expect(letterValue('Y')).toBe(7);
    expect(letterValue('中')).toBeNull();
  });

  it('keeps master numbers during reduction', () => {
    expect(reduceNumber(34)).toMatchObject({ value: 7, steps: [34, 7], isMaster: false });
    expect(reduceNumber(29)).toMatchObject({ value: 11, steps: [29, 11], isMaster: true });
    expect(reduceNumber(22)).toMatchObject({ value: 22, steps: [22], isMaster: true });
    expect(reduceNumber(33)).toMatchObject({ value: 33, steps: [33], isMaster: true });
  });

  it('calculates the documented life path examples', () => {
    expect(calculateLifePath('1980-07-31')?.reduction.value).toBe(2);
    expect(calculateLifePath('1990-05-23')?.reduction.value).toBe(11);
    expect(calculateLifePath('2000-12-05')?.reduction.value).toBe(1);
  });

  it('calculates name expression, soul, and personality numbers', () => {
    const reading = calculateNameReading('Harry');
    expect(reading.expression.total).toBe(34);
    expect(reading.expression.reduction.value).toBe(7);
    expect(reading.soul.reduction.value).toBe(1);
    expect(reading.personality.reduction.value).toBe(33);
  });

  it('ignores non-latin characters while preserving the latin trail', () => {
    const reading = calculateNameReading('哈利 Harry!');
    expect(reading.normalized).toBe('HARRY');
    expect(reading.ignoredCharacters).toEqual(['哈', '利', '!']);
    expect(reading.expression.reduction.value).toBe(7);
  });

  it('calculates personal year from birth month, birth day, and target year', () => {
    expect(calculatePersonalYear('1980-07-31', 2026)?.value).toBe(3);
    expect(calculatePersonalYear('2000-12-05', 2026)?.value).toBe(9);
  });

  it('combines expression numbers for compatibility theme', () => {
    const result = calculateCompatibility('Alice', 'Bob');
    expect(result.first.expression.reduction.value).toBe(3);
    expect(result.second.expression.reduction.value).toBe(1);
    expect(result.combinedTotal).toBe(4);
    expect(result.reduction.value).toBe(4);
  });
});
