/// <reference lib="webworker" />

import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';
import type {
  MeshBounds,
  MeshStats,
  RepairReport,
  RepairWorkerRequest,
  RepairWorkerResponse,
} from './types';

type MeshData = {
  positions: Float32Array;
  indices: Uint32Array;
};

type CleanupResult = {
  mesh: MeshData;
  skippedDegenerateFaces: number;
  skippedDuplicateFaces: number;
};

const ctx: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

const positionKey = (x: number, y: number, z: number, tolerance: number) => {
  if (tolerance <= 0) return `${x},${y},${z}`;
  return `${Math.round(x / tolerance)},${Math.round(y / tolerance)},${Math.round(z / tolerance)}`;
};

const triangleAreaSquared = (
  positions: number[] | Float32Array,
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

const cleanupMesh = (mesh: MeshData, tolerance: number): CleanupResult => {
  const vertexMap = new Map<string, number>();
  const positions: number[] = [];
  const indices: number[] = [];
  const faceKeys = new Set<string>();
  let skippedDegenerateFaces = 0;
  let skippedDuplicateFaces = 0;

  const getVertex = (sourceIndex: number) => {
    const x = mesh.positions[sourceIndex * 3];
    const y = mesh.positions[sourceIndex * 3 + 1];
    const z = mesh.positions[sourceIndex * 3 + 2];
    const key = positionKey(x, y, z, tolerance);
    const existing = vertexMap.get(key);

    if (existing !== undefined) return existing;

    const next = positions.length / 3;
    positions.push(x, y, z);
    vertexMap.set(key, next);
    return next;
  };

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const ia = getVertex(mesh.indices[offset]);
    const ib = getVertex(mesh.indices[offset + 1]);
    const ic = getVertex(mesh.indices[offset + 2]);

    if (
      ia === ib ||
      ib === ic ||
      ia === ic ||
      triangleAreaSquared(positions, ia, ib, ic) <= Number.EPSILON
    ) {
      skippedDegenerateFaces += 1;
      continue;
    }

    const sorted = [ia, ib, ic].sort((left, right) => left - right);
    const faceKey = `${sorted[0]}:${sorted[1]}:${sorted[2]}`;
    if (faceKeys.has(faceKey)) {
      skippedDuplicateFaces += 1;
      continue;
    }

    faceKeys.add(faceKey);
    indices.push(ia, ib, ic);
  }

  return {
    mesh: compactMesh({ positions: new Float32Array(positions), indices: new Uint32Array(indices) }),
    skippedDegenerateFaces,
    skippedDuplicateFaces,
  };
};

const compactMesh = (mesh: MeshData): MeshData => {
  const remap = new Map<number, number>();
  const positions: number[] = [];
  const indices = new Uint32Array(mesh.indices.length);

  for (let offset = 0; offset < mesh.indices.length; offset += 1) {
    const original = mesh.indices[offset];
    let mapped = remap.get(original);

    if (mapped === undefined) {
      mapped = positions.length / 3;
      remap.set(original, mapped);
      positions.push(
        mesh.positions[original * 3],
        mesh.positions[original * 3 + 1],
        mesh.positions[original * 3 + 2],
      );
    }

    indices[offset] = mapped;
  }

  return { positions: new Float32Array(positions), indices };
};

const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);

const getComponentFaceSets = (mesh: MeshData) => {
  const faceCount = mesh.indices.length / 3;
  const vertexToFaces = new Map<number, number[]>();

  for (let face = 0; face < faceCount; face += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const vertex = mesh.indices[face * 3 + corner];
      const faces = vertexToFaces.get(vertex);
      if (faces) {
        faces.push(face);
      } else {
        vertexToFaces.set(vertex, [face]);
      }
    }
  }

  const visited = new Uint8Array(faceCount);
  const components: number[][] = [];

  for (let seed = 0; seed < faceCount; seed += 1) {
    if (visited[seed]) continue;

    const component: number[] = [];
    const queue = [seed];
    visited[seed] = 1;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const face = queue[cursor];
      component.push(face);

      for (let corner = 0; corner < 3; corner += 1) {
        const vertex = mesh.indices[face * 3 + corner];
        const neighbors = vertexToFaces.get(vertex) ?? [];
        for (const neighbor of neighbors) {
          if (!visited[neighbor]) {
            visited[neighbor] = 1;
            queue.push(neighbor);
          }
        }
      }
    }

    components.push(component);
  }

  return components.sort((left, right) => right.length - left.length);
};

const keepLargestComponent = (mesh: MeshData) => {
  const components = getComponentFaceSets(mesh);
  if (components.length <= 1) {
    return { mesh, removedFragments: 0 };
  }

  const keep = components[0];
  const indices = new Uint32Array(keep.length * 3);
  keep.forEach((face, index) => {
    indices[index * 3] = mesh.indices[face * 3];
    indices[index * 3 + 1] = mesh.indices[face * 3 + 1];
    indices[index * 3 + 2] = mesh.indices[face * 3 + 2];
  });

  return {
    mesh: compactMesh({ positions: mesh.positions, indices }),
    removedFragments: components.length - 1,
  };
};

const computeBounds = (positions: Float32Array): MeshBounds => {
  const min: [number, number, number] = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: [number, number, number] = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];

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

const computeStats = (mesh: MeshData): MeshStats => {
  const edgeCounts = new Map<string, number>();
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const a = mesh.indices[offset];
    const b = mesh.indices[offset + 1];
    const c = mesh.indices[offset + 2];

    for (const [left, right] of [[a, b], [b, c], [c, a]]) {
      const key = edgeKey(left, right);
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  edgeCounts.forEach(count => {
    if (count === 1) boundaryEdges += 1;
    if (count > 2) nonManifoldEdges += 1;
  });

  const components = getComponentFaceSets(mesh);

  return {
    vertices: mesh.positions.length / 3,
    faces: mesh.indices.length / 3,
    components: components.length,
    largestComponentFaces: components[0]?.length ?? 0,
    boundaryEdges,
    nonManifoldEdges,
    watertight: mesh.indices.length > 0 && boundaryEdges === 0 && nonManifoldEdges === 0,
    bounds: computeBounds(mesh.positions),
  };
};

const findBoundaryEdges = (mesh: MeshData) => {
  const edges = new Map<string, { count: number; a: number; b: number }>();

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const vertices = [mesh.indices[offset], mesh.indices[offset + 1], mesh.indices[offset + 2]];
    for (const [a, b] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = edgeKey(a, b);
      const edge = edges.get(key);
      if (edge) {
        edge.count += 1;
      } else {
        edges.set(key, { count: 1, a, b });
      }
    }
  }

  return Array.from(edges.values()).filter(edge => edge.count === 1);
};

const fillSmallBoundaryLoops = (mesh: MeshData, maxEdges: number) => {
  const boundaryEdges = findBoundaryEdges(mesh);
  const adjacency = new Map<number, number[]>();
  const unused = new Set<string>();

  const addNeighbor = (a: number, b: number) => {
    const neighbors = adjacency.get(a);
    if (neighbors) {
      neighbors.push(b);
    } else {
      adjacency.set(a, [b]);
    }
  };

  for (const edge of boundaryEdges) {
    addNeighbor(edge.a, edge.b);
    addNeighbor(edge.b, edge.a);
    unused.add(edgeKey(edge.a, edge.b));
  }

  const positions = Array.from(mesh.positions);
  const indices = Array.from(mesh.indices);
  let filledHoles = 0;

  for (const edge of boundaryEdges) {
    const firstKey = edgeKey(edge.a, edge.b);
    if (!unused.has(firstKey)) continue;

    const loop = [edge.a, edge.b];
    unused.delete(firstKey);
    let previous = edge.a;
    let current = edge.b;
    let closed = false;

    while (loop.length <= maxEdges + 1) {
      const next = (adjacency.get(current) ?? []).find(candidate => {
        if (candidate === previous) return false;
        return unused.has(edgeKey(current, candidate)) || candidate === loop[0];
      });

      if (next === undefined) break;
      if (next === loop[0]) {
        closed = true;
        unused.delete(edgeKey(current, next));
        break;
      }

      unused.delete(edgeKey(current, next));
      loop.push(next);
      previous = current;
      current = next;
    }

    if (!closed || loop.length < 3 || loop.length > maxEdges) continue;

    const unique = new Set(loop);
    if (unique.size !== loop.length) continue;

    const centerIndex = positions.length / 3;
    const center = [0, 0, 0];
    for (const vertex of loop) {
      center[0] += positions[vertex * 3];
      center[1] += positions[vertex * 3 + 1];
      center[2] += positions[vertex * 3 + 2];
    }
    center[0] /= loop.length;
    center[1] /= loop.length;
    center[2] /= loop.length;
    positions.push(center[0], center[1], center[2]);

    for (let index = 0; index < loop.length; index += 1) {
      indices.push(loop[index], loop[(index + 1) % loop.length], centerIndex);
    }

    filledHoles += 1;
  }

  if (!filledHoles) return { mesh, filledHoles };

  return {
    mesh: cleanupMesh({ positions: new Float32Array(positions), indices: new Uint32Array(indices) }, 0).mesh,
    filledHoles,
  };
};

const simplifyMesh = async (mesh: MeshData, targetFaces: number, targetError: number) => {
  if (mesh.indices.length / 3 <= targetFaces) {
    return { mesh, simplified: false, simplifyError: null };
  }

  if (!MeshoptSimplifier.supported) {
    return { mesh, simplified: false, simplifyError: null };
  }

  await MeshoptSimplifier.ready;

  const targetIndexCount = Math.max(3, Math.floor(targetFaces) * 3);
  const [indices, error] = MeshoptSimplifier.simplify(
    mesh.indices,
    mesh.positions,
    3,
    targetIndexCount,
    targetError,
    ['Prune', 'Regularize'],
  );

  return {
    mesh: compactMesh({ positions: mesh.positions, indices }),
    simplified: indices.length !== mesh.indices.length,
    simplifyError: error,
  };
};

const addCylinderBase = (mesh: MeshData) => {
  const bounds = computeBounds(mesh.positions);
  const [sizeX, sizeY, sizeZ] = bounds.size;
  const maxXY = Math.max(sizeX, sizeY);
  const thickness = Math.max(sizeZ * 0.1, maxXY * 0.08, 1e-6);
  const diameter = Math.max(maxXY * 1.35, sizeZ * 0.45);
  const radius = diameter / 2;
  const sections = 96;
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;
  const topZ = bounds.min[2];
  const bottomZ = bounds.min[2] - thickness;

  const positions = Array.from(mesh.positions);
  const indices = Array.from(mesh.indices);
  const start = positions.length / 3;

  for (let index = 0; index < sections; index += 1) {
    const angle = (Math.PI * 2 * index) / sections;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    positions.push(x, y, topZ, x, y, bottomZ);
  }

  const topCenter = positions.length / 3;
  positions.push(centerX, centerY, topZ);
  const bottomCenter = positions.length / 3;
  positions.push(centerX, centerY, bottomZ);

  for (let index = 0; index < sections; index += 1) {
    const next = (index + 1) % sections;
    const topA = start + index * 2;
    const bottomA = topA + 1;
    const topB = start + next * 2;
    const bottomB = topB + 1;

    indices.push(topA, bottomA, bottomB, topA, bottomB, topB);
    indices.push(topCenter, topB, topA);
    indices.push(bottomCenter, bottomA, bottomB);
  }

  return {
    mesh: { positions: new Float32Array(positions), indices: new Uint32Array(indices) },
    baseInfo: { diameter, thickness },
  };
};

const writeNormal = (view: DataView, offset: number, normal: [number, number, number]) => {
  view.setFloat32(offset, normal[0], true);
  view.setFloat32(offset + 4, normal[1], true);
  view.setFloat32(offset + 8, normal[2], true);
};

const getFaceNormal = (positions: Float32Array, ia: number, ib: number, ic: number): [number, number, number] => {
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
  const length = Math.hypot(nx, ny, nz) || 1;

  return [nx / length, ny / length, nz / length];
};

const serializeBinaryStl = (mesh: MeshData, fileName: string) => {
  const faceCount = mesh.indices.length / 3;
  const buffer = new ArrayBuffer(84 + faceCount * 50);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();
  const header = encoder.encode(`Generated by dev-tools STL Repair: ${fileName}`.slice(0, 80));
  new Uint8Array(buffer, 0, 80).set(header);
  view.setUint32(80, faceCount, true);

  let offset = 84;
  for (let face = 0; face < faceCount; face += 1) {
    const ia = mesh.indices[face * 3];
    const ib = mesh.indices[face * 3 + 1];
    const ic = mesh.indices[face * 3 + 2];
    writeNormal(view, offset, getFaceNormal(mesh.positions, ia, ib, ic));
    offset += 12;

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

const processMesh = async (request: RepairWorkerRequest): Promise<RepairWorkerResponse> => {
  const parsed = parseStl(request.buffer);
  if (!parsed.indices.length) {
    throw new Error('STL 没有可处理的三角面');
  }

  const initial = computeStats(parsed);
  const cleanup = cleanupMesh(parsed, request.options.weldTolerance);
  let mesh = cleanup.mesh;
  let removedFragments = 0;

  if (request.options.keepLargest) {
    const result = keepLargestComponent(mesh);
    mesh = result.mesh;
    removedFragments = result.removedFragments;
  }

  const afterCleanup = computeStats(mesh);
  let filledHoles = 0;
  if (request.options.fillHoles && afterCleanup.boundaryEdges > 0) {
    const fillResult = fillSmallBoundaryLoops(mesh, request.options.holeEdgeLimit);
    mesh = fillResult.mesh;
    filledHoles = fillResult.filledHoles;
  }

  const simplify = request.options.decimate
    ? await simplifyMesh(mesh, request.options.targetFaces, request.options.targetError)
    : { mesh, simplified: false, simplifyError: null };
  mesh = simplify.mesh;

  let baseInfo: RepairReport['baseInfo'];
  if (request.options.addBase) {
    const result = addCylinderBase(mesh);
    mesh = result.mesh;
    baseInfo = result.baseInfo;
  }

  mesh = cleanupMesh(mesh, 0).mesh;
  const final = computeStats(mesh);
  const notes: string[] = [];

  if (!final.watertight) {
    notes.push('结果仍存在边界边或非流形边，适合作为轻量修复结果，不等价于工业级自动修复。');
  }
  if (simplify.simplified && final.faces > request.options.targetFaces) {
    notes.push('降面器受拓扑限制，最终面数可能高于目标值。');
  }
  if (request.options.addBase) {
    notes.push('圆形底座按模型当前坐标比例生成，STL 本身不携带单位信息。');
  }

  const stl = serializeBinaryStl(mesh, request.fileName);
  const positions = mesh.positions.slice().buffer;
  const indices = mesh.indices.slice().buffer;

  return {
    id: request.id,
    type: 'success',
    mesh: { positions, indices },
    stl,
    report: {
      fileName: request.fileName,
      initial,
      afterCleanup,
      final,
      skippedDegenerateFaces: cleanup.skippedDegenerateFaces,
      skippedDuplicateFaces: cleanup.skippedDuplicateFaces,
      removedFragments,
      filledHoles,
      addedBase: request.options.addBase,
      baseInfo,
      simplified: simplify.simplified,
      simplifyError: simplify.simplifyError,
      notes,
    },
  };
};

ctx.onmessage = async (event: MessageEvent<RepairWorkerRequest>) => {
  try {
    const response = await processMesh(event.data);
    ctx.postMessage(response, [response.mesh.positions, response.mesh.indices, response.stl]);
  } catch (error) {
    ctx.postMessage({
      id: event.data.id,
      type: 'error',
      error: error instanceof Error ? error.message : 'STL 处理失败',
    } satisfies RepairWorkerResponse);
  }
};
