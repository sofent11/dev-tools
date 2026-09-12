import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_WORKER_ENDPOINT, parseFromSource, videoCapabilityBoundaries } from '../VideoDownloader';

const readFixture = (name: string) =>
  readFileSync(join(process.cwd(), 'components/tools/__fixtures__', name), 'utf8');

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

  it('extracts video candidates from an HTML fixture without network access', () => {
    const result = parseFromSource(readFixture('video-page.html'), 'https://example.com/watch/fixture', 'generic');

    expect(result.title).toBe('Fixture Video Page');
    expect(result.thumbnail).toBe('https://cdn.example.com/thumb.jpg');
    expect(result.author).toBe('Fixture Author');
    expect(result.formats.map(format => format.url)).toEqual(expect.arrayContaining([
      'https://cdn.example.com/video-720p.mp4',
      'https://cdn.example.com/stream/master.m3u8',
      'https://cdn.example.com/backup.webm',
    ]));
  });
});
