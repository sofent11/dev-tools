import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKER_ENDPOINT, videoCapabilityBoundaries } from '../VideoDownloader';

describe('video downloader capability boundaries', () => {
  it('documents private Worker limits without absolute unlock claims', () => {
    const text = videoCapabilityBoundaries
      .flatMap(item => [item.label, item.support, item.boundary])
      .join('\n');

    expect(text).toContain('不绕过登录、DRM、地区、风控、版权');
    expect(text).not.toContain('完美解锁全部解析功能');
  });

  it('keeps the public sopace Worker endpoint as the default', () => {
    expect(DEFAULT_WORKER_ENDPOINT).toBe('https://api-dev.sopace.top');
  });
});
