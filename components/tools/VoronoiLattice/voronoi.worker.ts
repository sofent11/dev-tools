/// <reference lib="webworker" />

import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import type {
  HoleDensity,
  LatticeThickness,
  MeshBounds,
  VoronoiReport,
  VoronoiWorkerRequest,
  VoronoiWorkerResponse,
} from './types';

type Vec3 = [number, number, number];

type MeshData = {
  positions: Float32Array;
  indices: Uint32Array;
};

type FaceSampleData = {
  a: number;
  b: number;
  c: number;
  area: number;
  cumulative: number;
  normal: Vec3;
};

type SeedPoint = {
  position: Vec3;
  normal: Vec3;
};

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

const densitySettings: Record<HoleDensity, { min: number; base: number; factor: number; max: number; neighbors: number; maxEdge: number }> = {
  low: { min: 72, base: 86, factor: 1.1, max: 150, neighbors: 3, maxEdge: 0.42 },
  standard: { min: 130, base: 145, factor: 1.85, max: 270, neighbors: 4, maxEdge: 0.34 },
  high: { min: 220, base: 230, factor: 2.8, max: 430, neighbors: 5, maxEdge: 0.27 },
};

const thicknessSettings: Record<LatticeThickness, { radius: number; radialSegments: number; sphereSegments: number; label: string }> = {
  plane: { radius: 0.0026, radialSegments: 5, sphereSegments: 6, label: '平面预览' },
  thin: { radius: 0.0065, radialSegments: 7, sphereSegments: 7, label: '细' },
  standard: { radius: 0.0105, radialSegments: 8, sphereSegments: 8, label: '标准' },
  thick: { radius: 0.016, radialSegments: 10, sphereSegments: 9, label: '粗' },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return ((state >>> 0) / 4294967296);
  };
};

const positionKey = (x: number, y: number, z: number, tolerance: number) =>
  `${Math.round(x / tolerance)},${Math.round(y / tolerance)},${Math.round(z / tolerance)}`;

const vecAdd = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vecSub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vecScale = (a: Vec3, scale: number): Vec3 => [a[0] * scale, a[1] * scale, a[2] * scale];
const vecDot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vecCross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vecLength = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const vecNormalize = (a: Vec3): Vec3 => {
  const length = vecLength(a) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};
const vecDistanceSq = (a: Vec3, b: Vec3) => {
  const x = a[0] - b[0];
  const y = a[1] - b[1];
  const z = a[2] - b[2];
  return x * x + y * y + z * z;
};

const readVertex = (positions: Float32Array, index: number): Vec3 => [
  positions[index * 3],
  positions[index * 3 + 1],
  positions[index * 3 + 2],
];

const triangleAreaAndNormal = (positions: Float32Array, ia: number, ib: number, ic: number) => {
  const a = readVertex(positions, ia);
  const b = readVertex(positions, ib);
  const c = readVertex(positions, ic);
  const cross = vecCross(vecSub(b, a), vecSub(c, a));
  const length = vecLength(cross);

  return {
    area: length * 0.5,
    normal: length > 0 ? vecScale(cross, 1 / length) : ([0, 0, 1] as Vec3),
  };
};

const triangleAreaSquaredFromArray = (
  positions: number[],
  ia: number,
  ib: number,
  ic: number,
) => {
  const ax = positions[ia * 3];
  const ay = positions[ia * 3 + 1];
  const az = positions[ia * 3 + 2];
  const bx = positions[ib * 3];
  const by = positions[ib * 3 + 1];
  const bz = positions[ib * 3 + 2];
  const cx = positions[ic * 3];
  const cy = positions[ic * 3 + 1];
  const cz = positions[ic * 3 + 2];
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const nx = aby * acz - abz * acy;
  const ny = abz * acx - abx * acz;
  const nz = abx * acy - aby * acx;

  return nx * nx + ny * ny + nz * nz;
};

const parseStl = (buffer: ArrayBuffer): MeshData => {
  const geometry = new STLLoader().parse(buffer);
  const positionAttribute = geometry.getAttribute('position');

  if (!positionAttribute) {
    throw new Error('STL 中没有可用的 position 数据');
  }

  const sourcePositions = positionAttribute.array as ArrayLike<number>;
  const positions = new Float32Array(sourcePositions.length);
  for (let index = 0; index < sourcePositions.length; index += 1) {
    positions[index] = sourcePositions[index];
  }

  const indexAttribute = geometry.getIndex();
  if (indexAttribute) {
    const sourceIndices = indexAttribute.array as ArrayLike<number>;
    const indices = new Uint32Array(sourceIndices.length);
    for (let index = 0; index < sourceIndices.length; index += 1) {
      indices[index] = sourceIndices[index];
    }
    return { positions, indices };
  }

  const indices = new Uint32Array(positions.length / 3);
  for (let index = 0; index < indices.length; index += 1) indices[index] = index;
  return { positions, indices };
};

const cleanupMesh = (mesh: MeshData): MeshData => {
  const bounds = computeBounds(mesh.positions);
  const diagonal = Math.max(Math.hypot(bounds.size[0], bounds.size[1], bounds.size[2]), 1);
  const tolerance = diagonal * 1e-7;
  const vertexMap = new Map<string, number>();
  const faceKeys = new Set<string>();
  const positions: number[] = [];
  const indices: number[] = [];

  const getVertex = (sourceIndex: number) => {
    const x = mesh.positions[sourceIndex * 3];
    const y = mesh.positions[sourceIndex * 3 + 1];
    const z = mesh.positions[sourceIndex * 3 + 2];
    const key = positionKey(x, y, z, tolerance);
    const existing = vertexMap.get(key);
    if (existing !== undefined) return existing;

    const next = positions.length / 3;
    vertexMap.set(key, next);
    positions.push(x, y, z);
    return next;
  };

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const ia = getVertex(mesh.indices[offset]);
    const ib = getVertex(mesh.indices[offset + 1]);
    const ic = getVertex(mesh.indices[offset + 2]);
    if (ia === ib || ib === ic || ia === ic) continue;

    if (triangleAreaSquaredFromArray(positions, ia, ib, ic) <= Number.EPSILON) continue;

    const key = [ia, ib, ic].sort((left, right) => left - right).join(':');
    if (faceKeys.has(key)) continue;

    faceKeys.add(key);
    indices.push(ia, ib, ic);
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
};

const computeBounds = (positions: Float32Array): MeshBounds => {
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

  for (let offset = 0; offset < positions.length; offset += 3) {
    min[0] = Math.min(min[0], positions[offset]);
    min[1] = Math.min(min[1], positions[offset + 1]);
    min[2] = Math.min(min[2], positions[offset + 2]);
    max[0] = Math.max(max[0], positions[offset]);
    max[1] = Math.max(max[1], positions[offset + 1]);
    max[2] = Math.max(max[2], positions[offset + 2]);
  }

  if (!positions.length) {
    min[0] = 0;
    min[1] = 0;
    min[2] = 0;
    max[0] = 0;
    max[1] = 0;
    max[2] = 0;
  }

  return {
    min,
    max,
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
  };
};

const buildFaceData = (mesh: MeshData) => {
  const faces: FaceSampleData[] = [];
  let cumulative = 0;

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const a = mesh.indices[offset];
    const b = mesh.indices[offset + 1];
    const c = mesh.indices[offset + 2];
    const { area, normal } = triangleAreaAndNormal(mesh.positions, a, b, c);
    if (area <= Number.EPSILON) continue;

    cumulative += area;
    faces.push({ a, b, c, area, cumulative, normal });
  }

  return { faces, totalArea: cumulative };
};

const findFace = (faces: FaceSampleData[], value: number) => {
  let low = 0;
  let high = faces.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (faces[middle].cumulative < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return faces[low];
};

const getSampleCount = (faceCount: number, density: HoleDensity) => {
  const settings = densitySettings[density];
  return clamp(Math.round(settings.base + Math.sqrt(faceCount) * settings.factor), settings.min, settings.max);
};

const sampleSurface = (mesh: MeshData, count: number, seed: number) => {
  const { faces, totalArea } = buildFaceData(mesh);
  if (!faces.length || totalArea <= 0) throw new Error('STL 没有可采样的有效三角面');

  const rng = createRng(seed);
  const samples: SeedPoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const face = findFace(faces, rng() * totalArea);
    const va = readVertex(mesh.positions, face.a);
    const vb = readVertex(mesh.positions, face.b);
    const vc = readVertex(mesh.positions, face.c);
    const r1 = Math.sqrt(rng());
    const r2 = rng();
    const wa = 1 - r1;
    const wb = r1 * (1 - r2);
    const wc = r1 * r2;

    samples.push({
      position: [
        va[0] * wa + vb[0] * wb + vc[0] * wc,
        va[1] * wa + vb[1] * wb + vc[1] * wc,
        va[2] * wa + vb[2] * wb + vc[2] * wc,
      ],
      normal: face.normal,
    });
  }

  return samples;
};

const buildEdges = (points: SeedPoint[], bounds: MeshBounds, density: HoleDensity, radius: number) => {
  const settings = densitySettings[density];
  const diagonal = Math.max(Math.hypot(bounds.size[0], bounds.size[1], bounds.size[2]), 1);
  const maxDistanceSq = (diagonal * settings.maxEdge) ** 2;
  const minDistanceSq = (radius * 3.6) ** 2;
  const edgeKeys = new Set<string>();
  const edges: Array<[number, number]> = [];

  const addEdge = (left: number, right: number) => {
    if (left === right) return;
    const a = Math.min(left, right);
    const b = Math.max(left, right);
    const key = `${a}:${b}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push([a, b]);
  };

  for (let left = 0; left < points.length; left += 1) {
    const candidates: Array<{ index: number; distanceSq: number; normalDot: number }> = [];

    for (let right = 0; right < points.length; right += 1) {
      if (left === right) continue;
      const distanceSq = vecDistanceSq(points[left].position, points[right].position);
      if (distanceSq < minDistanceSq) continue;
      candidates.push({
        index: right,
        distanceSq,
        normalDot: vecDot(points[left].normal, points[right].normal),
      });
    }

    candidates.sort((a, b) => a.distanceSq - b.distanceSq);
    const accepted = candidates.filter(candidate => candidate.distanceSq <= maxDistanceSq && candidate.normalDot >= -0.35);
    const neighbors = (accepted.length ? accepted : candidates).slice(0, settings.neighbors);
    neighbors.forEach(candidate => addEdge(left, candidate.index));
  }

  return edges;
};

const pushVec = (target: number[], value: Vec3) => {
  target.push(value[0], value[1], value[2]);
};

const addCylinder = (
  positions: number[],
  indices: number[],
  start: Vec3,
  end: Vec3,
  radius: number,
  radialSegments: number,
) => {
  const axis = vecSub(end, start);
  const length = vecLength(axis);
  if (length <= radius * 0.4) return;

  const direction = vecScale(axis, 1 / length);
  const helper: Vec3 = Math.abs(direction[2]) < 0.88 ? [0, 0, 1] : [0, 1, 0];
  const tangent = vecNormalize(vecCross(direction, helper));
  const bitangent = vecNormalize(vecCross(direction, tangent));
  const ringStart = positions.length / 3;

  for (let index = 0; index < radialSegments; index += 1) {
    const angle = (Math.PI * 2 * index) / radialSegments;
    const normal = vecAdd(vecScale(tangent, Math.cos(angle) * radius), vecScale(bitangent, Math.sin(angle) * radius));
    pushVec(positions, vecAdd(start, normal));
    pushVec(positions, vecAdd(end, normal));
  }

  for (let index = 0; index < radialSegments; index += 1) {
    const next = (index + 1) % radialSegments;
    const a = ringStart + index * 2;
    const b = a + 1;
    const c = ringStart + next * 2;
    const d = c + 1;
    indices.push(a, b, d, a, d, c);
  }

  const startCenter = positions.length / 3;
  pushVec(positions, start);
  const endCenter = positions.length / 3;
  pushVec(positions, end);

  for (let index = 0; index < radialSegments; index += 1) {
    const next = (index + 1) % radialSegments;
    const a = ringStart + index * 2;
    const b = ringStart + next * 2;
    const c = a + 1;
    const d = b + 1;
    indices.push(startCenter, b, a);
    indices.push(endCenter, c, d);
  }
};

const addSphere = (
  positions: number[],
  indices: number[],
  center: Vec3,
  radius: number,
  segments: number,
) => {
  const widthSegments = Math.max(5, segments);
  const heightSegments = Math.max(4, Math.floor(segments * 0.65));
  const start = positions.length / 3;

  for (let y = 0; y <= heightSegments; y += 1) {
    const v = y / heightSegments;
    const phi = v * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let x = 0; x <= widthSegments; x += 1) {
      const u = x / widthSegments;
      const theta = u * Math.PI * 2;
      positions.push(
        center[0] + Math.cos(theta) * sinPhi * radius,
        center[1] + Math.sin(theta) * sinPhi * radius,
        center[2] + cosPhi * radius,
      );
    }
  }

  for (let y = 0; y < heightSegments; y += 1) {
    for (let x = 0; x < widthSegments; x += 1) {
      const a = start + y * (widthSegments + 1) + x;
      const b = a + widthSegments + 1;
      const c = b + 1;
      const d = a + 1;
      if (y !== 0) indices.push(a, b, d);
      if (y !== heightSegments - 1) indices.push(d, b, c);
    }
  }
};

const buildLatticeMesh = (
  points: SeedPoint[],
  edges: Array<[number, number]>,
  radius: number,
  thickness: LatticeThickness,
) => {
  const settings = thicknessSettings[thickness];
  const positions: number[] = [];
  const indices: number[] = [];

  for (const [left, right] of edges) {
    addCylinder(
      positions,
      indices,
      points[left].position,
      points[right].position,
      radius,
      settings.radialSegments,
    );
  }

  const connected = new Set<number>();
  for (const [left, right] of edges) {
    connected.add(left);
    connected.add(right);
  }

  connected.forEach(index => {
    addSphere(positions, indices, points[index].position, radius * 1.25, settings.sphereSegments);
  });

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
  };
};

const getFaceNormal = (positions: Float32Array, ia: number, ib: number, ic: number): Vec3 => {
  const { normal } = triangleAreaAndNormal(positions, ia, ib, ic);
  return normal;
};

const serializeBinaryStl = (mesh: MeshData, fileName: string) => {
  const faceCount = mesh.indices.length / 3;
  const buffer = new ArrayBuffer(84 + faceCount * 50);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();
  const header = encoder.encode(`Generated by dev-tools Voronoi Lattice: ${fileName}`.slice(0, 80));
  new Uint8Array(buffer, 0, 80).set(header);
  view.setUint32(80, faceCount, true);

  let offset = 84;
  for (let face = 0; face < faceCount; face += 1) {
    const ia = mesh.indices[face * 3];
    const ib = mesh.indices[face * 3 + 1];
    const ic = mesh.indices[face * 3 + 2];
    const normal = getFaceNormal(mesh.positions, ia, ib, ic);
    for (const value of normal) {
      view.setFloat32(offset, value, true);
      offset += 4;
    }

    for (const vertex of [ia, ib, ic]) {
      view.setFloat32(offset, mesh.positions[vertex * 3], true);
      view.setFloat32(offset + 4, mesh.positions[vertex * 3 + 1], true);
      view.setFloat32(offset + 8, mesh.positions[vertex * 3 + 2], true);
      offset += 12;
    }

    view.setUint16(offset, 0, true);
    offset += 2;
  }

  return buffer;
};

const processMesh = (request: VoronoiWorkerRequest): VoronoiWorkerResponse => {
  const parsed = cleanupMesh(parseStl(request.buffer));
  if (!parsed.indices.length) {
    throw new Error('STL 没有可处理的三角面');
  }

  const bounds = computeBounds(parsed.positions);
  const diagonal = Math.max(Math.hypot(bounds.size[0], bounds.size[1], bounds.size[2]), 1);
  const seedCount = getSampleCount(parsed.indices.length / 3, request.options.holeDensity);
  const thickness = thicknessSettings[request.options.thickness];
  const radius = diagonal * thickness.radius;
  const points = sampleSurface(parsed, seedCount, hashString(`${request.fileName}:${request.options.holeDensity}:${parsed.indices.length}`));
  const edges = buildEdges(points, bounds, request.options.holeDensity, radius);
  const lattice = buildLatticeMesh(points, edges, radius, request.options.thickness);

  if (!lattice.indices.length) {
    throw new Error('未能生成有效杆件，请尝试减少孔数量或使用更厚设置');
  }

  const stl = serializeBinaryStl(lattice, request.fileName);
  const notes = [
    '第一版使用表面采样与近邻杆件生成 Voronoi 风格镂空，不执行实体布尔挖孔。',
    '导出 STL 由相交圆管和节点球组成，适合视觉预览和继续修复，不保证打印级水密。',
  ];

  if (request.options.thickness === 'plane') {
    notes.push('平面预览使用极细杆件近似，打印前请选择细/标准/粗并在切片软件中复检。');
  } else {
    notes.push(`当前厚度为${thickness.label}，杆半径按模型包围盒对角线比例生成。`);
  }

  const report: VoronoiReport = {
    fileName: request.fileName,
    inputFaces: parsed.indices.length / 3,
    inputVertices: parsed.positions.length / 3,
    inputBounds: bounds,
    seedPoints: points.length,
    rods: edges.length,
    outputFaces: lattice.indices.length / 3,
    outputVertices: lattice.positions.length / 3,
    outputBytes: stl.byteLength,
    radius,
    nonPrintable: request.options.thickness === 'plane',
    notes,
  };

  const originalPositions = parsed.positions.slice().buffer;
  const originalIndices = parsed.indices.slice().buffer;
  const latticePositions = lattice.positions.slice().buffer;
  const latticeIndices = lattice.indices.slice().buffer;

  return {
    id: request.id,
    type: 'success',
    original: { positions: originalPositions, indices: originalIndices },
    lattice: { positions: latticePositions, indices: latticeIndices },
    stl,
    report,
  };
};

ctx.onmessage = (event: MessageEvent<VoronoiWorkerRequest>) => {
  try {
    const response = processMesh(event.data);
    ctx.postMessage(response, [
      response.original.positions,
      response.original.indices,
      response.lattice.positions,
      response.lattice.indices,
      response.stl,
    ]);
  } catch (error) {
    ctx.postMessage({
      id: event.data.id,
      type: 'error',
      error: error instanceof Error ? error.message : 'Voronoi 镂空处理失败',
    } satisfies VoronoiWorkerResponse);
  }
};
