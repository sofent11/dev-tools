import { describe, expect, it } from 'vitest';
import { sanitizeArchiveFileName } from '../AnimationFrameExtractor';

describe('animation frame export helpers', () => {
  it('sanitizes unsafe archive file names', () => {
    expect(sanitizeArchiveFileName('../weird:name*with?spaces')).toBe('_weird_name_with_spaces');
    expect(sanitizeArchiveFileName('')).toBe('animation');
  });
});
