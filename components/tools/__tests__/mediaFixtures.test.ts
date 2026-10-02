import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseGIF, decompressFrames } from 'gifuct-js';
import { PDFDocument } from 'pdf-lib';
describe('real media fixtures', () => {
  it('decodes the expected GIF frames, delays and pixels', () => {
    const bytes = new Uint8Array(readFileSync('tests/fixtures/two-frames.gif'));
    const frames = decompressFrames(parseGIF(bytes.buffer), true);
    expect(frames.map(frame => frame.delay)).toEqual([50,100]);
    expect(Array.from(frames[0].patch)).toEqual([0,0,0,255]);
    expect(Array.from(frames[1].patch)).toEqual([255,255,255,255]);
  });
  it('merges actual PDF pages in the requested order and size', async () => {
    const source = await PDFDocument.load(new Uint8Array(readFileSync('tests/fixtures/two-pages.pdf')));
    const target = await PDFDocument.create();
    for (const page of await target.copyPages(source, [1,0])) target.addPage(page);
    const reloaded = await PDFDocument.load(await target.save());
    expect(reloaded.getPageCount()).toBe(2);
    expect(reloaded.getPage(0).getSize()).toEqual({ width:144, height:72 });
  });
});
