import { describe, expect, it } from 'vitest';
import { getImageDecoderFramePlan, sanitizeArchiveFileName } from '../AnimationFrameExtractor';

describe('animation frame export helpers', () => {
  it('sanitizes unsafe archive file names', () => {
    expect(sanitizeArchiveFileName('../weird:name*with?spaces')).toBe('_weird_name_with_spaces');
    expect(sanitizeArchiveFileName('')).toBe('animation');
  });

  it('falls back to probe mode when ImageDecoder metadata does not expose real frame count', () => {
    expect(getImageDecoderFramePlan(undefined)).toMatchObject({ frameCountSource: 'probe' });
    expect(getImageDecoderFramePlan(1)).toMatchObject({ frameCountSource: 'probe' });
    expect(getImageDecoderFramePlan(24)).toEqual({ frameCount: 24, frameCountSource: 'metadata' });
  });
});
