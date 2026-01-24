import { Point, LabStats, ModelFacePack, SourceFacePack } from '../types';

// Declare globals
declare global {
  interface Window {
    FaceMesh: any;
    Delaunator: any;
  }
}

const MP_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/';

let faceMesh: any = null;
let isInitializing = false;
let CACHED_TRIANGLES: number[] | null = null;

// --- 1. STABLE INTERNAL TOPOLOGY (The "Mask" Region) ---
// This list creates a stable, convex hull around the features.
// It avoids the outer rim of the face to prevent "mask edges".
const MP_INDICES = [
  // CENTER VERTICAL LINE (Anchor)
  10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2,

  // LEFT EYE REGION
  33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7,
  // LEFT BROW
  70, 63, 105, 66, 107, 46, 53, 52, 65, 55,

  // RIGHT EYE REGION
  362, 398, 384, 385, 386, 387, 388, 466, 263, 390, 373, 374, 380, 381, 382, 249,
  // RIGHT BROW
  336, 296, 334, 293, 300, 276, 283, 282, 295, 285,

  // NOSE FLANKS
  198, 209, 49, 48, 219, 420, 437, 429, 279,

  // MOUTH AREA
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, // Upper Lip
  146, 91, 181, 84, 17, 314, 405, 321, 375, 291, // Lower Lip
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, // Inner Lip

  // CHEEKS / PERIMETER (Tight)
  127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, // Left Chin/Cheek
  377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356 // Right Chin/Cheek
];

async function initFaceMesh() {
  if (faceMesh) return faceMesh;
  if (isInitializing) {
    while (!faceMesh) await new Promise(r => setTimeout(r, 100));
    return faceMesh;
  }

  isInitializing = true;
  console.log("Initializing MediaPipe FaceMesh...");

  try {
    const fm = new window.FaceMesh({
      locateFile: (file: string) => `${MP_URL}${file}`
    });

    fm.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    fm.onResults(() => { });
    await fm.initialize();

    faceMesh = fm;
    return fm;
  } catch (e) {
    console.error("Failed to init FaceMesh", e);
    isInitializing = false;
    throw e;
  }
}

function mapMeshToLandmarks(landmarks: { x: number, y: number }[], width: number, height: number): Point[] {
  const get = (index: number) => ({
    x: landmarks[index].x * width,
    y: landmarks[index].y * height
  });
  return MP_INDICES.map(i => get(i));
}

export function getCanonicalTriangulation(points: Point[]): number[] {
  // If we already have a triangulation for this number of points, reuse it.
  // Delaunator can be slow, and for face meshes, the topology is mostly constant.
  if (CACHED_TRIANGLES && CACHED_TRIANGLES.length > 0) {
    // Basic check to ensure we don't access out of bounds if point count changed
    const maxIdx = Math.max(...CACHED_TRIANGLES);
    if (maxIdx < points.length) return CACHED_TRIANGLES;
  }

  if (!window.Delaunator) return [];

  const coords = new Float32Array(points.length * 2);
  for (let i = 0; i < points.length; i++) {
    coords[i * 2] = points[i].x;
    coords[i * 2 + 1] = points[i].y;
  }

  try {
    const delaunay = new window.Delaunator(coords);
    CACHED_TRIANGLES = Array.from(delaunay.triangles);
    return CACHED_TRIANGLES;
  } catch (e) {
    console.error(e);
    return [];
  }
}

export async function detectFace(imageElement: HTMLImageElement): Promise<Point[]> {
  const fm = await initFaceMesh();
  return new Promise((resolve) => {
    fm.onResults((results: any) => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        resolve(mapMeshToLandmarks(results.multiFaceLandmarks[0], imageElement.naturalWidth, imageElement.naturalHeight));
      } else {
        resolve([]);
      }
    });
    fm.send({ image: imageElement });
  });
}

// SIMPLIFIED RGB STATS
// We use the 'mean' field of LabStats to store pure RGB mean [r,g,b]
// We use the 'std' field to store pure RGB std [r,g,b]
export function computeSkinStats(img: HTMLImageElement, points: Point[]): LabStats {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx || points.length === 0) return { mean: [0.5, 0.5, 0.5], std: [0.1, 0.1, 0.1] };

  // Calculate face bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(p => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  });

  const w = maxX - minX;
  const h = maxY - minY;

  // T-ZONE SAMPLE (Center of face, avoiding edges)
  const cropW = w * 0.2;
  const cropH = h * 0.2;
  const cx = minX + w / 2 - cropW / 2;
  const cy = minY + h / 2 - cropH / 2;

  ctx.drawImage(img, 0, 0);
  const iData = ctx.getImageData(cx, cy, cropW, cropH);
  const data = iData.data;

  const Rs: number[] = [], Gs: number[] = [], Bs: number[] = [];

  for (let i = 0; i < data.length; i += 4 * 4) { // Sample every 4th pixel
    Rs.push(data[i] / 255);
    Gs.push(data[i + 1] / 255);
    Bs.push(data[i + 2] / 255);
  }

  const calc = (arr: number[]) => {
    if (arr.length === 0) return [0, 1];
    const mean = arr.reduce((acc, v) => acc + v, 0) / arr.length;
    const variance = arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / arr.length;
    return [mean, Math.sqrt(variance) || 0.001];
  };

  const [mR, sR] = calc(Rs);
  const [mG, sG] = calc(Gs);
  const [mB, sB] = calc(Bs);

  return { mean: [mR, mG, mB], std: [sR, sG, sB] };
}

export function createMaskUrl(width: number, height: number, points: Point[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  // --- GAUSSIAN MASK GENERATION ---

  let cx = 0, cy = 0;
  points.forEach(p => { cx += p.x; cy += p.y; });
  cx /= points.length;
  cy /= points.length;

  const faceWidth = Math.abs(points[0].x - points[points.length - 1].x);

  // Create a heavy radial gradient for soft falloff
  // This simulates the alpha blend used in Poisson blending
  const radius = faceWidth * 0.6;
  const grd = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius);
  grd.addColorStop(0, "white");
  grd.addColorStop(0.5, "rgba(255, 255, 255, 0.8)");
  grd.addColorStop(1, "black");

  ctx.fillStyle = grd;

  // Draw the gradient clipped to the convex hull of the mesh
  // This ensures we don't draw outside the mesh (which would cause texture repeat artifacts)
  ctx.beginPath();
  if (points.length > 0) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();

  return canvas.toDataURL('image/png');
}

export function createAlignedSource(img: HTMLImageElement, points: Point[]): { textureUrl: string, landmarks: Point[] } {
  // Simple crop and align
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(p => {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  });

  const w = maxX - minX;
  const h = maxY - minY;
  const padding = Math.max(w, h) * 0.5;

  const sx = Math.max(0, minX - padding);
  const sy = Math.max(0, minY - padding);
  const sw = Math.min(img.naturalWidth - sx, maxX + padding - sx);
  const sh = Math.min(img.naturalHeight - sy, maxY + padding - sy);

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { textureUrl: '', landmarks: [] };

  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);

  const scaleX = size / sw;
  const scaleY = size / sh;
  const newPoints = points.map(p => ({
    x: (p.x - sx) * scaleX,
    y: (p.y - sy) * scaleY
  }));

  return { textureUrl: canvas.toDataURL('image/jpeg', 0.95), landmarks: newPoints };
}

export async function processModelImage(url: string): Promise<ModelFacePack> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await new Promise((r, reject) => { img.onload = r; img.onerror = reject; });
  CACHED_TRIANGLES = null; // Reset cache
  const points = await detectFace(img);
  if (points.length === 0) throw new Error("No face found.");

  const triangles = getCanonicalTriangulation(points);
  const maskUrl = createMaskUrl(img.naturalWidth, img.naturalHeight, points);
  const stats = computeSkinStats(img, points);

  return {
    id: `m-${Date.now()}`,
    name: 'Base',
    imageUrl: url,
    width: img.naturalWidth,
    height: img.naturalHeight,
    landmarks: points,
    triangles,
    maskUrl,
    skinStats: stats
  };
}

export async function processSourceImage(url: string): Promise<SourceFacePack> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await new Promise((r, reject) => { img.onload = r; img.onerror = reject; });
  const points = await detectFace(img);
  if (points.length === 0) throw new Error("No face found.");

  const { textureUrl, landmarks } = createAlignedSource(img, points);
  const stats = computeSkinStats(img, points);

  return {
    id: `s-${Date.now()}`,
    name: 'Source',
    textureUrl,
    landmarks,
    skinStats: stats
  };
}