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

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

const positionKey = (x: number, y: number, z: number, tolerance = 0) => {
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

const indexVertices = (mesh: MeshData, tolerance = 0): MeshData => {
  const vertexMap = new Map<string, number>();
  const positions: number[] = [];
  const indices = new Uint32Array(mesh.indices.length);

  for (let offset = 0; offset < mesh.indices.length; offset += 1) {
    const sourceIndex = mesh.indices[offset];
    const x = mesh.positions[sourceIndex * 3];
    const y = mesh.positions[sourceIndex * 3 + 1];
    const z = mesh.positions[sourceIndex * 3 + 2];
    const key = positionKey(x, y, z, tolerance);
    let mapped = vertexMap.get(key);

    if (mapped === undefined) {
      mapped = positions.length / 3;
      vertexMap.set(key, mapped);
      positions.push(x, y, z);
    }

    indices[offset] = mapped;
  }

  return { positions: new Float32Array(positions), indices };
};

const cleanupMesh = (mesh: MeshData, tolerance = 0): CleanupResult => {
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

const faceKey = (a: number, b: number, c: number) => [a, b, c].sort((left, right) => left - right).join(':');

const getComponentFaceSets = (mesh: MeshData) => {
  const faceCount = mesh.indices.length / 3;
  const edgeToFaces = new Map<string, number[]>();

  for (let face = 0; face < faceCount; face += 1) {
    const offset = face * 3;
    const vertices = [mesh.indices[offset], mesh.indices[offset + 1], mesh.indices[offset + 2]];
    for (const [left, right] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      if (left === right) continue;
      const key = edgeKey(left, right);
      const faces = edgeToFaces.get(key);
      if (faces) {
        faces.push(face);
      } else {
        edgeToFaces.set(key, [face]);
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

      const offset = face * 3;
      const vertices = [mesh.indices[offset], mesh.indices[offset + 1], mesh.indices[offset + 2]];
      for (const [left, right] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
        const neighbors = edgeToFaces.get(edgeKey(left, right)) ?? [];
        if (neighbors.length !== 2) continue;

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

const getEdgeFaceMap = (mesh: MeshData) => {
  const edges = new Map<string, number[]>();

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const face = offset / 3;
    const vertices = [mesh.indices[offset], mesh.indices[offset + 1], mesh.indices[offset + 2]];
    for (const [a, b] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = edgeKey(a, b);
      const faces = edges.get(key);
      if (faces) {
        faces.push(face);
      } else {
        edges.set(key, [face]);
      }
    }
  }

  return edges;
};

const getBoundaryEdges = (mesh: MeshData) => {
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

const getEdgeCountMap = (mesh: MeshData) => {
  const edgeCounts = new Map<string, number>();

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const vertices = [mesh.indices[offset], mesh.indices[offset + 1], mesh.indices[offset + 2]];
    for (const [a, b] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = edgeKey(a, b);
      edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
    }
  }

  return edgeCounts;
};

const removeExtraNonManifoldFaces = (mesh: MeshData) => {
  const edgeFaces = getEdgeFaceMap(mesh);
  const removeFaces = new Set<number>();

  edgeFaces.forEach(faces => {
    if (faces.length <= 2) return;

    faces
      .map(face => ({
        face,
        area: triangleAreaSquared(
          mesh.positions,
          mesh.indices[face * 3],
          mesh.indices[face * 3 + 1],
          mesh.indices[face * 3 + 2],
        ),
      }))
      .sort((left, right) => right.area - left.area)
      .slice(2)
      .forEach(({ face }) => removeFaces.add(face));
  });

  if (!removeFaces.size) return { mesh, removedFaces: 0 };

  const indices: number[] = [];
  for (let face = 0; face < mesh.indices.length / 3; face += 1) {
    if (removeFaces.has(face)) continue;

    indices.push(
      mesh.indices[face * 3],
      mesh.indices[face * 3 + 1],
      mesh.indices[face * 3 + 2],
    );
  }

  return {
    mesh: compactMesh({ positions: mesh.positions, indices: new Uint32Array(indices) }),
    removedFaces: removeFaces.size,
  };
};

const fillSingleTriangleAndQuadHoles = (mesh: MeshData) => {
  const boundaryEdges = getBoundaryEdges(mesh);
  const adjacency = new Map<number, Set<number>>();
  const edgeSet = new Set<string>();
  const edgeCounts = getEdgeCountMap(mesh);

  const connect = (a: number, b: number) => {
    const neighbors = adjacency.get(a);
    if (neighbors) {
      neighbors.add(b);
    } else {
      adjacency.set(a, new Set([b]));
    }
  };

  for (const edge of boundaryEdges) {
    connect(edge.a, edge.b);
    connect(edge.b, edge.a);
    edgeSet.add(edgeKey(edge.a, edge.b));
  }

  const positions = Array.from(mesh.positions);
  const indices = Array.from(mesh.indices);
  const usedEdges = new Set<string>();
  const faceKeys = new Set<string>();
  let filledHoles = 0;

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    faceKeys.add(faceKey(mesh.indices[offset], mesh.indices[offset + 1], mesh.indices[offset + 2]));
  }

  for (const edge of boundaryEdges) {
    const firstKey = edgeKey(edge.a, edge.b);
    if (usedEdges.has(firstKey)) continue;

    const loop = findBoundaryLoop(edge.a, edge.b, adjacency, edgeSet);
    if (!loop || loop.length < 3 || loop.length > 4) continue;

    const loopEdges = loop.map((vertex, index) => edgeKey(vertex, loop[(index + 1) % loop.length]));
    if (loopEdges.some(key => usedEdges.has(key))) continue;

    if (loop.length === 3) {
      indices.push(loop[0], loop[1], loop[2]);
    } else {
      const diagonalA = edgeKey(loop[0], loop[2]);
      const diagonalB = edgeKey(loop[1], loop[3]);
      const trianglesA = [[loop[0], loop[1], loop[2]], [loop[0], loop[2], loop[3]]];
      const trianglesB = [[loop[1], loop[2], loop[3]], [loop[1], loop[3], loop[0]]];
      const canUseA = (edgeCounts.get(diagonalA) ?? 0) === 0 && trianglesA.every(([a, b, c]) => !faceKeys.has(faceKey(a, b, c)));
      const canUseB = (edgeCounts.get(diagonalB) ?? 0) === 0 && trianglesB.every(([a, b, c]) => !faceKeys.has(faceKey(a, b, c)));

      if (canUseA || canUseB) {
        const triangles = canUseB && !canUseA ? trianglesB : trianglesA;
        for (const [a, b, c] of triangles) indices.push(a, b, c);
      } else {
        const centerIndex = positions.length / 3;
        const center = [0, 0, 0];
        for (const vertex of loop) {
          center[0] += positions[vertex * 3];
          center[1] += positions[vertex * 3 + 1];
          center[2] += positions[vertex * 3 + 2];
        }
        positions.push(center[0] / 4, center[1] / 4, center[2] / 4);
        for (let index = 0; index < loop.length; index += 1) {
          indices.push(loop[index], loop[(index + 1) % loop.length], centerIndex);
        }
      }
    }

    loopEdges.forEach(key => usedEdges.add(key));
    filledHoles += 1;
  }

  if (!filledHoles) return { mesh, filledHoles };

  return {
    mesh: cleanupMesh({ positions: new Float32Array(positions), indices: new Uint32Array(indices) }, 0).mesh,
    filledHoles,
  };
};

const findBoundaryLoop = (
  start: number,
  next: number,
  adjacency: Map<number, Set<number>>,
  edgeSet: Set<string>,
) => {
  const loop = [start, next];
  let previous = start;
  let current = next;

  while (loop.length <= 4) {
    const candidates = Array.from(adjacency.get(current) ?? []);
    const candidate = candidates.find(vertex => {
      if (vertex === previous) return false;
      if (vertex === start) return loop.length >= 3;
      return !loop.includes(vertex) && edgeSet.has(edgeKey(current, vertex));
    });

    if (candidate === undefined) return null;
    if (candidate === start) return loop;

    loop.push(candidate);
    previous = current;
    current = candidate;
  }

  return null;
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
    ['LockBorder'],
  );

  return {
    mesh: compactMesh({ positions: mesh.positions, indices }),
    simplified: indices.length !== mesh.indices.length,
    simplifyError: error,
  };
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

const getSignedVolume = (mesh: MeshData) => {
  let volume = 0;

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const ia = mesh.indices[offset] * 3;
    const ib = mesh.indices[offset + 1] * 3;
    const ic = mesh.indices[offset + 2] * 3;
    const ax = mesh.positions[ia];
    const ay = mesh.positions[ia + 1];
    const az = mesh.positions[ia + 2];
    const bx = mesh.positions[ib];
    const by = mesh.positions[ib + 1];
    const bz = mesh.positions[ib + 2];
    const cx = mesh.positions[ic];
    const cy = mesh.positions[ic + 1];
    const cz = mesh.positions[ic + 2];

    volume += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }

  return volume / 6;
};

const orientFacesConsistently = (mesh: MeshData): MeshData => {
  const faceCount = mesh.indices.length / 3;
  const oriented = new Uint32Array(mesh.indices);
  const edgeToFaces = new Map<string, Array<{ face: number; from: number; to: number }>>();

  for (let face = 0; face < faceCount; face += 1) {
    const vertices = [oriented[face * 3], oriented[face * 3 + 1], oriented[face * 3 + 2]];
    for (const [from, to] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
      const key = edgeKey(from, to);
      const faces = edgeToFaces.get(key);
      const entry = { face, from, to };
      if (faces) {
        faces.push(entry);
      } else {
        edgeToFaces.set(key, [entry]);
      }
    }
  }

  const flipFace = (face: number) => {
    const offset = face * 3;
    const tmp = oriented[offset + 1];
    oriented[offset + 1] = oriented[offset + 2];
    oriented[offset + 2] = tmp;
  };

  const faceHasDirectedEdge = (face: number, from: number, to: number) => {
    const offset = face * 3;
    const a = oriented[offset];
    const b = oriented[offset + 1];
    const c = oriented[offset + 2];
    return (a === from && b === to) || (b === from && c === to) || (c === from && a === to);
  };

  const visited = new Uint8Array(faceCount);
  for (let seed = 0; seed < faceCount; seed += 1) {
    if (visited[seed]) continue;

    const queue = [seed];
    visited[seed] = 1;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const face = queue[cursor];
      const offset = face * 3;
      const vertices = [oriented[offset], oriented[offset + 1], oriented[offset + 2]];

      for (const [from, to] of [[vertices[0], vertices[1]], [vertices[1], vertices[2]], [vertices[2], vertices[0]]]) {
        const neighbors = edgeToFaces.get(edgeKey(from, to)) ?? [];
        for (const neighbor of neighbors) {
          if (neighbor.face === face || visited[neighbor.face]) continue;

          if (faceHasDirectedEdge(neighbor.face, to, from) === false) {
            flipFace(neighbor.face);
          }

          visited[neighbor.face] = 1;
          queue.push(neighbor.face);
        }
      }
    }
  }

  return fixOutwardNormals({ positions: mesh.positions, indices: oriented });
};

const fixOutwardNormals = (mesh: MeshData): MeshData => {
  const signedVolume = getSignedVolume(mesh);
  if (Math.abs(signedVolume) > Number.EPSILON) {
    if (signedVolume > 0) return mesh;

    const indices = new Uint32Array(mesh.indices);
    for (let offset = 0; offset < indices.length; offset += 3) {
      const tmp = indices[offset + 1];
      indices[offset + 1] = indices[offset + 2];
      indices[offset + 2] = tmp;
    }

    return { positions: mesh.positions, indices };
  }

  const bounds = computeBounds(mesh.positions);
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  let signed = 0;

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const ia = mesh.indices[offset];
    const ib = mesh.indices[offset + 1];
    const ic = mesh.indices[offset + 2];
    const normal = getFaceNormal(mesh.positions, ia, ib, ic);
    const faceCenter = [
      (mesh.positions[ia * 3] + mesh.positions[ib * 3] + mesh.positions[ic * 3]) / 3,
      (mesh.positions[ia * 3 + 1] + mesh.positions[ib * 3 + 1] + mesh.positions[ic * 3 + 1]) / 3,
      (mesh.positions[ia * 3 + 2] + mesh.positions[ib * 3 + 2] + mesh.positions[ic * 3 + 2]) / 3,
    ];
    signed +=
      normal[0] * (faceCenter[0] - center[0]) +
      normal[1] * (faceCenter[1] - center[1]) +
      normal[2] * (faceCenter[2] - center[2]);
  }

  if (signed >= 0) return mesh;

  const indices = new Uint32Array(mesh.indices);
  for (let offset = 0; offset < indices.length; offset += 3) {
    const tmp = indices[offset + 1];
    indices[offset + 1] = indices[offset + 2];
    indices[offset + 2] = tmp;
  }

  return { positions: mesh.positions, indices };
};

const estimateBaseInfo = (mesh: MeshData) => {
  const bounds = computeBounds(mesh.positions);
  const [sizeX, sizeY, sizeZ] = bounds.size;
  const maxXY = Math.max(sizeX, sizeY);
  const thickness = Math.max(sizeZ * 0.1, maxXY * 0.08, 1e-6);
  const diameter = Math.max(maxXY * 1.35, sizeZ * 0.45);
  return { bounds, thickness, diameter };
};

const addCylinderBase = (mesh: MeshData) => {
  const { bounds, thickness, diameter } = estimateBaseInfo(mesh);
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
    mesh: cleanupMesh({ positions: new Float32Array(positions), indices: new Uint32Array(indices) }, 0).mesh,
    baseInfo: { diameter, thickness },
  };
};

const writeNormal = (view: DataView, offset: number, normal: [number, number, number]) => {
  view.setFloat32(offset, normal[0], true);
  view.setFloat32(offset + 4, normal[1], true);
  view.setFloat32(offset + 8, normal[2], true);
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

const reportProgress = (id: number, status: string, progress: number) => {
  ctx.postMessage({ id, type: 'progress', status, progress } satisfies RepairWorkerResponse);
};

const processMesh = async (request: RepairWorkerRequest): Promise<RepairWorkerResponse> => {
  reportProgress(request.id, '正在解析并载入 STL 顶点数据...', 10);
  const parsed = indexVertices(parseStl(request.buffer), 0);
  if (!parsed.indices.length) {
    throw new Error('STL 没有可处理的三角面');
  }

  let mesh = parsed;
  let removedFragments = 0;

  if (request.options.keepLargest) {
    reportProgress(request.id, '正在移除孤立小拓扑碎片...', 25);
    const result = keepLargestComponent(mesh);
    mesh = result.mesh;
    removedFragments = result.removedFragments;
  }

  reportProgress(request.id, '正在统计几何特性并构建拓扑索引...', 35);
  const initial = computeStats(mesh);
  
  reportProgress(request.id, '正在执行三维顶点焊接与去重...', 45);
  const cleanup = cleanupMesh(mesh, request.options.weldTolerance);
  mesh = cleanup.mesh;
  const afterCleanup = computeStats(mesh);

  let simplified = false;
  let simplifyError: number | null = null;
  if (request.options.decimate) {
    reportProgress(request.id, '正在进行三维面数降面处理 (Mesh Simplification)...', 60);
    const simplifyResult = await simplifyMesh(mesh, request.options.targetFaces, request.options.targetError);
    mesh = simplifyResult.mesh;
    simplified = simplifyResult.simplified;
    simplifyError = simplifyResult.simplifyError;
  }

  const simplify = { mesh, simplified, simplifyError };

  let removedPostSimplifyFragments = 0;
  if (request.options.keepLargest && simplify.simplified) {
    reportProgress(request.id, '正在对降面后模型剔除小碎片...', 70);
    const simplifiedStats = computeStats(mesh);
    if (!simplifiedStats.watertight && simplifiedStats.components > 1) {
      const result = keepLargestComponent(mesh);
      mesh = result.mesh;
      removedPostSimplifyFragments = result.removedFragments;
    }
  }

  let removedNonManifoldFaces = 0;
  if (computeStats(mesh).nonManifoldEdges > 0) {
    reportProgress(request.id, '正在定位并移除边界非流形面...', 75);
    const result = removeExtraNonManifoldFaces(mesh);
    mesh = result.mesh;
    removedNonManifoldFaces = result.removedFaces;
  }

  reportProgress(request.id, '正在规范法线朝向与几何水密性...', 80);
  mesh = orientFacesConsistently(mesh);

  let filledHoles = 0;
  if (request.options.fillHoles && computeStats(mesh).watertight === false) {
    reportProgress(request.id, '正在执行小孔补面算法 (填补单三角及四边形孔)...', 88);
    const fillResult = fillSingleTriangleAndQuadHoles(mesh);
    mesh = orientFacesConsistently(fillResult.mesh);
    filledHoles = fillResult.filledHoles;
  }

  let baseInfo: RepairReport['baseInfo'];
  if (request.options.addBase) {
    reportProgress(request.id, '正在构造圆形切片底座并与 STL 合并...', 93);
    const result = addCylinderBase(mesh);
    mesh = orientFacesConsistently(result.mesh);
    baseInfo = result.baseInfo;
  }

  reportProgress(request.id, '正在序列化为二进制 STL 二进制数组并优化显存传输...', 98);
  const final = computeStats(mesh);
  const notes: string[] = [];

  if (!final.watertight) {
    notes.push('结果仍非完全水密；这与 Python 脚本一致，fill_holes 仅能补小三角/四边孔，复杂坏面需要复检。');
  } else {
    notes.push('当前边界/非流形边检测为水密。');
  }
  if (simplify.simplified && final.faces > request.options.targetFaces) {
    notes.push('降面器受拓扑限制，最终面数可能高于目标值。');
  }
  if (removedPostSimplifyFragments > 0) {
    notes.push(`降面后剔除了 ${removedPostSimplifyFragments} 个非流形小片，以保留最大主体。`);
  }
  if (removedNonManifoldFaces > 0) {
    notes.push(`降面后移除了 ${removedNonManifoldFaces} 个非流形面，并通过小孔补面恢复闭合。`);
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
      removedPostSimplifyFragments,
      removedNonManifoldFaces,
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
    if (response.type === 'success') {
      ctx.postMessage(response, [response.mesh.positions, response.mesh.indices, response.stl]);
    } else {
      ctx.postMessage(response);
    }
  } catch (error) {
    ctx.postMessage({
      id: event.data.id,
      type: 'error',
      error: error instanceof Error ? error.message : 'STL 处理失败',
    } satisfies RepairWorkerResponse);
  }
};
