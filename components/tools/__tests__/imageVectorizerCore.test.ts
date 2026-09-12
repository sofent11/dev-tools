import { describe, expect, it } from 'vitest';
import { runMarchingEdges, simplifyCollinearPath } from '../images/vectorizerCore';

const createCanvasFixture = (width: number, height: number, data: number[]) => ({
  width,
  height,
  getContext: () => ({
    getImageData: () => ({
      data: new Uint8ClampedArray(data),
    }),
  }),
}) as unknown as HTMLCanvasElement;

describe('image vectorizer core', () => {
  it('removes nearly collinear points while preserving corners', () => {
    const simplified = simplifyCollinearPath([
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ], 0.5);

    expect(simplified).toEqual([
      [0, 0],
      [2, 0],
      [2, 2],
    ]);
  });

  it('extracts a path around foreground pixels', () => {
    const black = [0, 0, 0, 255];
    const white = [255, 255, 255, 255];
    const canvas = createCanvasFixture(2, 2, [
      ...black, ...white,
      ...white, ...white,
    ]);

    const path = runMarchingEdges(canvas, 128, false, 0);

    expect(path).toContain('M ');
    expect(path).toContain('Z');
  });
});
