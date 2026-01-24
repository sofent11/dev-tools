export interface Point {
  x: number;
  y: number;
}

export interface LabStats {
  mean: [number, number, number]; // L, a, b
  std: [number, number, number];  // L, a, b
}

// Represents the Model (Destination) pre-processed data
export interface ModelFacePack {
  id: string;
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  // In a real app, these are 68 or 106 points. We use a simplified grid for demo.
  landmarks: Point[]; 
  // Indices for triangulation (e.g., Delaunay). 
  // Shared if topology is identical, but good to have per pack just in case.
  triangles: number[];
  maskUrl: string; // The alpha mask for the face region
  skinStats: LabStats;
}

// Represents the Source (Template) pre-processed data
export interface SourceFacePack {
  id: string;
  name: string;
  textureUrl: string; // Pre-aligned, cropped face texture
  // Landmarks in the UV space (0-1) or pixel space of the texture
  landmarks: Point[]; 
  skinStats: LabStats;
}

export interface WebGLContextData {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  textures: Map<string, WebGLTexture>;
}