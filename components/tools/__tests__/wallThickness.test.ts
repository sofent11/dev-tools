import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WallThicknessWorkerResponse } from '../StlRepair/wallThickness.worker';
afterEach(() => vi.unstubAllGlobals());
describe('wall thickness numeric fixture', () => {
  it.each(['fast', 'precise'] as const)('estimates a pair of planes 0.5 mm apart in %s mode', async mode => {
    vi.resetModules();
    const messages: WallThicknessWorkerResponse[] = [];
    const scope = { onmessage: undefined as ((event: { data: unknown }) => void) | undefined, postMessage: (message: WallThicknessWorkerResponse) => messages.push(message) };
    vi.stubGlobal('self', scope);
    await import('../StlRepair/wallThickness.worker');
    scope.onmessage!({ data: { id:1, positions:new Float32Array([0,0,0, 10,0,0, 0,10,0, 0,0,0.5, 10,0,0.5, 0,10,0.5]), indices:new Uint32Array([0,2,1,3,4,5]), threshold:0.8, mode } });
    const result=messages.find(message => message.type==='success');
    expect(result?.type).toBe('success');
    if(result?.type==='success') {
      expect(result.report.minThickness).toBeCloseTo(0.5, 3);
      expect(result.report.thinFaces).toBe(2);
      expect(result.report.partial).toBe(false);
    }
  });
});
