import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from 'three';
import { getCsgTrianglePositions } from '../studios/CsgWorkbench';
import { getDesignBounds } from '../JewelryCustomizer/utils/designBounds';
import { isGeometryQuestion } from '../SmartGeometry';
import { MOCK_QUESTION } from '../SmartGeometry/data/mockData';
import { isImageDecoderEndError } from '../AnimationFrameExtractor';

describe('CSG Worker input geometry', () => {
  it('expands an indexed cube into all 12 triangles without mutating the source', () => {
    const cube = new BoxGeometry(2, 4, 6);
    const index = cube.index!;
    const vertices = cube.getAttribute('position');
    const result = getCsgTrianglePositions(cube);
    expect(result.length).toBe(12 * 9);
    for (let i = 0; i < index.count; i++) {
      const vertex = index.getX(i);
      expect([...result.slice(i * 3, i * 3 + 3)]).toEqual([vertices.getX(vertex), vertices.getY(vertex), vertices.getZ(vertex)]);
    }
    expect(cube.index).toBe(index);
    cube.dispose();
  });

  it('preserves indexed shared-mesh triangles, including reused vertices', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    expect([...getCsgTrianglePositions(geometry)]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]);
    geometry.dispose();
  });

  it('rejects incomplete or non-finite triangles before Worker submission', () => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
    expect(() => getCsgTrianglePositions(geometry)).toThrow('完整三角面');
    geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, NaN, 1, 0], 3));
    expect(() => getCsgTrianglePositions(geometry)).toThrow('无效坐标');
    geometry.dispose();
  });
});

describe('Jewelry shared design origin', () => {
  it('keeps asymmetric text and backing-frame offsets in one coordinate system', () => {
    const text = [[0, 0], [10, 0], [10, 5], [0, 5]];
    const frame = [[-5, -2], [30, -2], [30, 9], [-5, 9]];
    const bounds = getDesignBounds([text, frame]);
    expect(bounds).toMatchObject({ width: 35, height: 11, centerX: 12.5, centerY: 3.5 });
    const movedText = text.map(([x, y]) => [x - bounds.centerX, y - bounds.centerY]);
    const movedFrame = frame.map(([x, y]) => [x - bounds.centerX, y - bounds.centerY]);
    expect(movedFrame[1][0] - movedText[1][0]).toBe(20);
  });
  it('rejects empty or invalid outlines for export', () => {
    expect(() => getDesignBounds([])).toThrow('没有可导出');
    expect(() => getDesignBounds([[[Infinity, 0]]])).toThrow('无效坐标');
  });
});

describe('Geometry question import', () => {
  it('accepts the existing exercise schema', () => expect(isGeometryQuestion(MOCK_QUESTION)).toBe(true));
  it('rejects broken drawing and teaching-step references', () => {
    const line = structuredClone(MOCK_QUESTION); line.entities.lines.broken = { from: 'missing', to: 'missing', style: 'solid' };
    expect(isGeometryQuestion(line)).toBe(false);
    const slide = structuredClone(MOCK_QUESTION); slide.slides[0].highlightPoints = ['missing'];
    expect(isGeometryQuestion(slide)).toBe(false);
    const polygon = structuredClone(MOCK_QUESTION); polygon.entities.polygons.broken = { vertices: [], fill: '#fff' };
    expect(isGeometryQuestion(polygon)).toBe(false);
  });
  it('rejects huge coordinates that cannot fit safely in the canvas', () => {
    const question = structuredClone(MOCK_QUESTION); Object.values(question.entities.points)[0].x = 1e300;
    expect(isGeometryQuestion(question)).toBe(false);
  });
});


describe('Animation decoder end detection', () => {
  it('recognizes index exhaustion but never treats a corrupt frame as animation end', () => {
    expect(isImageDecoderEndError(new DOMException('frame index out of range', 'IndexSizeError'))).toBe(true);
    expect(isImageDecoderEndError(new RangeError('frame index exceeds frame count'))).toBe(true);
    expect(isImageDecoderEndError(new Error('Unable to decode frame because data is corrupt'))).toBe(false);
    expect(isImageDecoderEndError(new Error('Invalid frame data'))).toBe(false);
  });
});
