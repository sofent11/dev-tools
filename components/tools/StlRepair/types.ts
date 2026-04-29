export interface MeshTransfer {
  positions: ArrayBuffer;
  indices: ArrayBuffer;
}

export interface MeshPreviewData {
  positions: Float32Array;
  indices: Uint32Array;
}

export interface MeshBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
}

export interface MeshStats {
  vertices: number;
  faces: number;
  components: number;
  largestComponentFaces: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  watertight: boolean;
  bounds: MeshBounds;
}

export interface RepairOptions {
  targetFaces: number;
  weldTolerance: number;
  targetError: number;
  decimate: boolean;
  keepLargest: boolean;
  fillHoles: boolean;
  addBase: boolean;
}

export interface RepairReport {
  fileName: string;
  initial: MeshStats;
  afterCleanup: MeshStats;
  final: MeshStats;
  skippedDegenerateFaces: number;
  skippedDuplicateFaces: number;
  removedFragments: number;
  removedPostSimplifyFragments: number;
  removedNonManifoldFaces: number;
  filledHoles: number;
  addedBase: boolean;
  baseInfo?: {
    diameter: number;
    thickness: number;
  };
  simplified: boolean;
  simplifyError: number | null;
  notes: string[];
}

export type RepairWorkerRequest = {
  id: number;
  fileName: string;
  buffer: ArrayBuffer;
  options: RepairOptions;
};

export type RepairWorkerResponse =
  | {
      id: number;
      type: 'success';
      mesh: MeshTransfer;
      stl: ArrayBuffer;
      report: RepairReport;
    }
  | {
      id: number;
      type: 'error';
      error: string;
    };
