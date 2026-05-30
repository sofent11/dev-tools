import { create } from 'zustand';

export interface SharedMesh {
  positions: Float32Array;
  indices: Uint32Array;
  fileName: string;
}

interface MeshStore {
  sharedMesh: SharedMesh | null;
  setSharedMesh: (mesh: SharedMesh | null) => void;
}

export const useMeshStore = create<MeshStore>((set) => ({
  sharedMesh: null,
  setSharedMesh: (mesh) => set({ sharedMesh: mesh }),
}));
