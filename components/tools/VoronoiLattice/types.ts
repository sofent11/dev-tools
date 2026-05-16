export type HoleDensity = 'low' | 'standard' | 'high';

export type LatticeThickness = 'plane' | 'thin' | 'standard' | 'thick';

export type PreviewMode = 'lattice' | 'mixed' | 'original';

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

export interface VoronoiOptions {
  holeDensity: HoleDensity;
  thickness: LatticeThickness;
  showOriginal: boolean;
}

export interface VoronoiReport {
  fileName: string;
  inputFaces: number;
  inputVertices: number;
  inputBounds: MeshBounds;
  seedPoints: number;
  rods: number;
  outputFaces: number;
  outputVertices: number;
  outputBytes: number;
  radius: number;
  nonPrintable: boolean;
  notes: string[];
}

export type VoronoiWorkerRequest = {
  id: number;
  fileName: string;
  buffer: ArrayBuffer;
  options: VoronoiOptions;
};

export type VoronoiWorkerResponse =
  | {
      id: number;
      type: 'success';
      original: MeshTransfer;
      lattice: MeshTransfer;
      stl: ArrayBuffer;
      report: VoronoiReport;
    }
  | {
      id: number;
      type: 'error';
      error: string;
    };
