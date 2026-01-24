import { ModelFacePack, SourceFacePack } from '../types';

/**
 * TECHNICAL NOTE:
 * In a real production environment, these "Packs" are generated offline by a Python pipeline 
 * (using Dlib/FaceMesh + OpenCV) and served via CDN.
 * 
 * For this purely frontend demo, we simulate:
 * 1. Landmarks: A simplified 3x3 grid mesh to demonstrate affine warping.
 * 2. Triangles: Hardcoded indices for the grid.
 * 3. Stats: Hardcoded LAB color stats.
 */

// A simple 9-point grid topology for the face center (Indices 0-8)
// 0 - 1 - 2
// | / | / |
// 3 - 4 - 5
// | / | / |
// 6 - 7 - 8
export const MOCK_TRIANGLES = [
  0, 1, 3,   1, 4, 3,
  1, 2, 4,   2, 5, 4,
  3, 4, 6,   4, 7, 6,
  4, 5, 7,   5, 8, 7
];

// Helper to generate a data URI for a gradient mask (simulating a feathered PNG)
const createMaskDataUri = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0,0,512,512);
    // Draw a white feathered oval in the center
    const grad = ctx.createRadialGradient(256, 256, 50, 256, 256, 200);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.6, 'rgba(255, 255, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(256, 256, 160, 200, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas.toDataURL();
};

const MASK_URI = createMaskDataUri();

// -- MODELS --

export const MODELS: ModelFacePack[] = [
  {
    id: 'm1',
    name: 'Model: Urban',
    imageUrl: 'https://picsum.photos/id/64/800/800', // Girl in city
    width: 800,
    height: 800,
    maskUrl: MASK_URI,
    // Simulating detected landmarks on the image (pixel coords)
    landmarks: [
      { x: 300, y: 300 }, { x: 400, y: 290 }, { x: 500, y: 300 }, // Eyes/Brows level
      { x: 290, y: 400 }, { x: 400, y: 410 }, { x: 510, y: 400 }, // Nose/Cheek level
      { x: 320, y: 550 }, { x: 400, y: 580 }, { x: 480, y: 550 }, // Mouth/Chin level
    ],
    triangles: MOCK_TRIANGLES,
    skinStats: { mean: [60, 10, 10], std: [15, 5, 5] }, // L, A, B approx
  },
  {
    id: 'm2',
    name: 'Model: Studio',
    imageUrl: 'https://picsum.photos/id/338/800/800',
    width: 800,
    height: 800,
    maskUrl: MASK_URI,
    landmarks: [
       // Slightly different pose/shape
      { x: 280, y: 250 }, { x: 400, y: 240 }, { x: 520, y: 250 },
      { x: 270, y: 380 }, { x: 400, y: 390 }, { x: 530, y: 380 },
      { x: 310, y: 520 }, { x: 400, y: 540 }, { x: 490, y: 520 },
    ],
    triangles: MOCK_TRIANGLES,
    skinStats: { mean: [80, 5, 15], std: [10, 3, 3] }, // Lighter skin
  }
];

// -- SOURCES --
// In reality, these are "aligned" textures (e.g. 512x512)

export const SOURCES: SourceFacePack[] = [
  {
    id: 's1',
    name: 'Source: Cyber',
    // Using a different image to represent the "face texture"
    textureUrl: 'https://picsum.photos/id/453/512/512', 
    landmarks: [
      // Standard aligned coordinates (0-512)
      { x: 100, y: 100 }, { x: 256, y: 100 }, { x: 412, y: 100 },
      { x: 100, y: 256 }, { x: 256, y: 256 }, { x: 412, y: 256 },
      { x: 150, y: 400 }, { x: 256, y: 450 }, { x: 362, y: 400 },
    ],
    skinStats: { mean: [50, 15, -5], std: [20, 5, 5] }, // darker, cooler
  },
  {
    id: 's2',
    name: 'Source: Vintage',
    textureUrl: 'https://picsum.photos/id/237/512/512', // Dog (just for fun/contrast)
    landmarks: [
      { x: 100, y: 100 }, { x: 256, y: 100 }, { x: 412, y: 100 },
      { x: 100, y: 256 }, { x: 256, y: 256 }, { x: 412, y: 256 },
      { x: 150, y: 400 }, { x: 256, y: 450 }, { x: 362, y: 400 },
    ],
    skinStats: { mean: [40, 5, 20], std: [15, 8, 8] }, 
  },
    {
    id: 's3',
    name: 'Source: Bright',
    textureUrl: 'https://picsum.photos/id/65/512/512', 
    landmarks: [
      { x: 100, y: 100 }, { x: 256, y: 100 }, { x: 412, y: 100 },
      { x: 100, y: 256 }, { x: 256, y: 256 }, { x: 412, y: 256 },
      { x: 150, y: 400 }, { x: 256, y: 450 }, { x: 362, y: 400 },
    ],
    skinStats: { mean: [85, 2, 2], std: [10, 2, 2] }, 
  }
];