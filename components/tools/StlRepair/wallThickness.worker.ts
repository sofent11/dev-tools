export interface WallThicknessWorkerRequest {
  id: number;
  positions: Float32Array;
  indices: Uint32Array;
  threshold: number;
  mode: 'fast' | 'precise';
  maxAnalysisMs?: number;
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
  partial?: boolean;
  estimatedWork?: number;
  abortedByBudget?: boolean;
  acceleration?: 'none' | 'grid' | 'bvh';
  candidateTests?: number;
  skippedFaces?: number;
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

interface TriangleGrid {
  acceleration: 'grid' | 'none';
  resolution: number;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
  cellSize: [number, number, number];
  cells: Map<string, number[]>;
  targetFaces: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const cellKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

const buildTriangleGrid = (positions: Float32Array, indices: Uint32Array, faceCount: number, targetStep: number): TriangleGrid => {
  if (faceCount < 200) {
    return {
      acceleration: 'none',
      resolution: 1,
      boundsMin: [0, 0, 0],
      boundsMax: [0, 0, 0],
      cellSize: [1, 1, 1],
      cells: new Map(),
      targetFaces: Math.ceil(faceCount / targetStep),
    };
  }

  const boundsMin: [number, number, number] = [Infinity, Infinity, Infinity];
  const boundsMax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    boundsMin[0] = Math.min(boundsMin[0], positions[i]);
    boundsMin[1] = Math.min(boundsMin[1], positions[i + 1]);
    boundsMin[2] = Math.min(boundsMin[2], positions[i + 2]);
    boundsMax[0] = Math.max(boundsMax[0], positions[i]);
    boundsMax[1] = Math.max(boundsMax[1], positions[i + 1]);
    boundsMax[2] = Math.max(boundsMax[2], positions[i + 2]);
  }

  const targetFaces = Math.ceil(faceCount / targetStep);
  const resolution = clamp(Math.round(Math.cbrt(targetFaces) * 1.8), 6, 24);
  const cellSize: [number, number, number] = [
    Math.max((boundsMax[0] - boundsMin[0]) / resolution, 1e-6),
    Math.max((boundsMax[1] - boundsMin[1]) / resolution, 1e-6),
    Math.max((boundsMax[2] - boundsMin[2]) / resolution, 1e-6),
  ];
  const cells = new Map<string, number[]>();

  const toCell = (value: number, axis: 0 | 1 | 2) =>
    clamp(Math.floor((value - boundsMin[axis]) / cellSize[axis]), 0, resolution - 1);

  for (let faceIndex = 0; faceIndex < faceCount; faceIndex += targetStep) {
    const a = getVertex(positions, indices[faceIndex * 3]);
    const b = getVertex(positions, indices[faceIndex * 3 + 1]);
    const c = getVertex(positions, indices[faceIndex * 3 + 2]);
    const minX = Math.min(a[0], b[0], c[0]);
    const minY = Math.min(a[1], b[1], c[1]);
    const minZ = Math.min(a[2], b[2], c[2]);
    const maxX = Math.max(a[0], b[0], c[0]);
    const maxY = Math.max(a[1], b[1], c[1]);
    const maxZ = Math.max(a[2], b[2], c[2]);
    for (let x = toCell(minX, 0); x <= toCell(maxX, 0); x += 1) {
      for (let y = toCell(minY, 1); y <= toCell(maxY, 1); y += 1) {
        for (let z = toCell(minZ, 2); z <= toCell(maxZ, 2); z += 1) {
          const key = cellKey(x, y, z);
          const bucket = cells.get(key);
          if (bucket) bucket.push(faceIndex);
          else cells.set(key, [faceIndex]);
        }
      }
    }
  }

  return { acceleration: 'grid', resolution, boundsMin, boundsMax, cellSize, cells, targetFaces };
};

const collectGridCandidates = (
  grid: TriangleGrid,
  origin: [number, number, number],
  direction: [number, number, number],
  maxDistance: number,
) => {
  if (grid.acceleration === 'none') return null;
  const candidates = new Set<number>();
  const stepDistance = Math.max(Math.min(...grid.cellSize) * 0.7, maxDistance / 96, 1e-4);
  const toCell = (value: number, axis: 0 | 1 | 2) =>
    clamp(Math.floor((value - grid.boundsMin[axis]) / grid.cellSize[axis]), 0, grid.resolution - 1);

  for (let distance = 0; distance <= maxDistance; distance += stepDistance) {
    const x = origin[0] + direction[0] * distance;
    const y = origin[1] + direction[1] * distance;
    const z = origin[2] + direction[2] * distance;
    if (
      x < grid.boundsMin[0] || x > grid.boundsMax[0] ||
      y < grid.boundsMin[1] || y > grid.boundsMax[1] ||
      z < grid.boundsMin[2] || z > grid.boundsMax[2]
    ) {
      continue;
    }
    const bucket = grid.cells.get(cellKey(toCell(x, 0), toCell(y, 1), toCell(z, 2)));
    if (bucket) {
      for (const faceIndex of bucket) candidates.add(faceIndex);
    }
  }

  return candidates;
};

self.onmessage = (event: MessageEvent<WallThicknessWorkerRequest>) => {
  const started = performance.now();
  const { id, positions, indices, threshold, mode, maxAnalysisMs } = event.data;

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
    const targetStep = mode === 'precise' ? 1 : Math.max(1, Math.floor(faceCount / 5000));
    const estimatedWork = Math.ceil(faceCount / step) * Math.ceil(faceCount / targetStep);
    const grid = buildTriangleGrid(positions, indices, faceCount, targetStep);
    const budgetMs = maxAnalysisMs ?? (mode === 'precise' ? 6500 : 2500);
    let sampledFaces = 0;
    let thinFaces = 0;
    let minThickness: number | null = null;
    let abortedByBudget = false;
    let candidateTests = 0;
    let skippedFaces = 0;

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
      const candidates = collectGridCandidates(grid, origin, direction, threshold * 8);
      const targetFaces = candidates && candidates.size > 0 ? candidates : null;
      if (targetFaces) {
        skippedFaces += Math.max(0, grid.targetFaces - targetFaces.size);
      }

      const scanTargetFace = (targetFace: number) => {
        if (targetFace === faceIndex) return;
        const ta = getVertex(positions, indices[targetFace * 3]);
        const tb = getVertex(positions, indices[targetFace * 3 + 1]);
        const tc = getVertex(positions, indices[targetFace * 3 + 2]);
        candidateTests += 1;
        const dist = rayTriangleDistance(origin, direction, ta, tb, tc);
        if (dist !== null && dist < threshold * 8 && (best === null || dist < best)) {
          best = dist;
        }
      };

      if (targetFaces) {
        for (const targetFace of targetFaces) scanTargetFace(targetFace);
      } else {
        for (let targetFace = 0; targetFace < faceCount; targetFace += targetStep) {
          scanTargetFace(targetFace);
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
      if (performance.now() - started > budgetMs) {
        abortedByBudget = true;
        break;
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
      partial: abortedByBudget,
      estimatedWork,
      abortedByBudget,
      acceleration: grid.acceleration,
      candidateTests,
      skippedFaces,
    };

    self.postMessage({ id, type: 'success', report, colors }, [colors.buffer]);
  } catch (err) {
    self.postMessage({ id, type: 'error', error: (err as Error).message });
  }
};
