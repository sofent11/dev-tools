export interface WallThicknessWorkerRequest {
  id: number;
  positions: Float32Array;
  indices: Uint32Array;
  threshold: number;
  mode: 'fast' | 'precise';
}

export interface WallThicknessWorkerReport {
  sampledFaces: number;
  thinFaces: number;
  minThickness: number | null;
  threshold: number;
  mode: 'fast' | 'precise';
  confidence: 'low' | 'medium' | 'high';
  elapsedMs: number;
  sampleRate: number;
}

export type WallThicknessWorkerResponse =
  | { id: number; type: 'success'; report: WallThicknessWorkerReport; colors: Float32Array }
  | { id: number; type: 'progress'; progress: number }
  | { id: number; type: 'error'; error: string };

const neutral = [0.58, 0.64, 0.72] as const;

const colorForThickness = (thickness: number | null, threshold: number) => {
  if (thickness === null) return neutral;
  if (thickness < threshold * 0.65) return [0.94, 0.27, 0.27] as const;
  if (thickness < threshold) return [0.98, 0.45, 0.09] as const;
  return [0.13, 0.77, 0.37] as const;
};

const dot = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) =>
  ax * bx + ay * by + az * bz;

const normalize = (v: [number, number, number]) => {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  v[0] /= len;
  v[1] /= len;
  v[2] /= len;
  return v;
};

const getVertex = (positions: Float32Array, index: number): [number, number, number] => [
  positions[index * 3],
  positions[index * 3 + 1],
  positions[index * 3 + 2],
];

const rayTriangleDistance = (
  origin: [number, number, number],
  direction: [number, number, number],
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
) => {
  const edge1: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const edge2: [number, number, number] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const p: [number, number, number] = [
    direction[1] * edge2[2] - direction[2] * edge2[1],
    direction[2] * edge2[0] - direction[0] * edge2[2],
    direction[0] * edge2[1] - direction[1] * edge2[0],
  ];
  const det = dot(edge1[0], edge1[1], edge1[2], p[0], p[1], p[2]);
  if (Math.abs(det) < 1e-8) return null;
  const invDet = 1 / det;
  const t: [number, number, number] = [origin[0] - a[0], origin[1] - a[1], origin[2] - a[2]];
  const u = dot(t[0], t[1], t[2], p[0], p[1], p[2]) * invDet;
  if (u < 0 || u > 1) return null;
  const q: [number, number, number] = [
    t[1] * edge1[2] - t[2] * edge1[1],
    t[2] * edge1[0] - t[0] * edge1[2],
    t[0] * edge1[1] - t[1] * edge1[0],
  ];
  const v = dot(direction[0], direction[1], direction[2], q[0], q[1], q[2]) * invDet;
  if (v < 0 || u + v > 1) return null;
  const dist = dot(edge2[0], edge2[1], edge2[2], q[0], q[1], q[2]) * invDet;
  return dist > 1e-5 ? dist : null;
};

self.onmessage = (event: MessageEvent<WallThicknessWorkerRequest>) => {
  const started = performance.now();
  const { id, positions, indices, threshold, mode } = event.data;

  try {
    const faceCount = Math.floor(indices.length / 3);
    const colors = new Float32Array((positions.length / 3) * 3);
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = neutral[0];
      colors[i + 1] = neutral[1];
      colors[i + 2] = neutral[2];
    }

    const maxSamples = mode === 'precise' ? 2400 : 700;
    const step = Math.max(1, Math.floor(faceCount / maxSamples));
    let sampledFaces = 0;
    let thinFaces = 0;
    let minThickness: number | null = null;

    for (let faceIndex = 0; faceIndex < faceCount; faceIndex += step) {
      const ia = indices[faceIndex * 3];
      const ib = indices[faceIndex * 3 + 1];
      const ic = indices[faceIndex * 3 + 2];
      const a = getVertex(positions, ia);
      const b = getVertex(positions, ib);
      const c = getVertex(positions, ic);
      const center: [number, number, number] = [
        (a[0] + b[0] + c[0]) / 3,
        (a[1] + b[1] + c[1]) / 3,
        (a[2] + b[2] + c[2]) / 3,
      ];
      const edge1: [number, number, number] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const edge2: [number, number, number] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const normal = normalize([
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0],
      ]);
      const direction: [number, number, number] = [-normal[0], -normal[1], -normal[2]];
      const origin: [number, number, number] = [
        center[0] + direction[0] * 1e-4,
        center[1] + direction[1] * 1e-4,
        center[2] + direction[2] * 1e-4,
      ];

      let best: number | null = null;
      const targetStep = mode === 'precise' ? 1 : Math.max(1, Math.floor(faceCount / 5000));
      for (let targetFace = 0; targetFace < faceCount; targetFace += targetStep) {
        if (targetFace === faceIndex) continue;
        const ta = getVertex(positions, indices[targetFace * 3]);
        const tb = getVertex(positions, indices[targetFace * 3 + 1]);
        const tc = getVertex(positions, indices[targetFace * 3 + 2]);
        const dist = rayTriangleDistance(origin, direction, ta, tb, tc);
        if (dist !== null && dist < threshold * 8 && (best === null || dist < best)) {
          best = dist;
        }
      }

      if (best !== null) {
        minThickness = minThickness === null ? best : Math.min(minThickness, best);
        if (best < threshold) thinFaces += 1;
      }

      const color = colorForThickness(best, threshold);
      for (const index of [ia, ib, ic]) {
        colors[index * 3] = color[0];
        colors[index * 3 + 1] = color[1];
        colors[index * 3 + 2] = color[2];
      }
      sampledFaces += 1;

      if (sampledFaces % 80 === 0) {
        self.postMessage({ id, type: 'progress', progress: Math.min(95, Math.round((faceIndex / faceCount) * 100)) } satisfies WallThicknessWorkerResponse);
      }
    }

    const sampleRate = faceCount > 0 ? sampledFaces / faceCount : 0;
    const report: WallThicknessWorkerReport = {
      sampledFaces,
      thinFaces,
      minThickness,
      threshold,
      mode,
      confidence: mode === 'precise' ? 'high' : sampleRate > 0.2 ? 'medium' : 'low',
      elapsedMs: performance.now() - started,
      sampleRate,
    };

    self.postMessage({ id, type: 'success', report, colors }, [colors.buffer]);
  } catch (err) {
    self.postMessage({ id, type: 'error', error: (err as Error).message });
  }
};
