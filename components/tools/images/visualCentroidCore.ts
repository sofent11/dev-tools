export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  center: Point;
}

export interface CentroidResult {
  centroid: Point | null;
  boundingBox: BoundingBox | null;
  visiblePixels: number;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export const calculateVisualCentroid = (
  imageData: ImageData,
  alphaThreshold = 127,
): CentroidResult => {
  const { data, width, height } = imageData;
  let sumX = 0;
  let sumY = 0;
  let visiblePixels = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (data[index + 3] < alphaThreshold) continue;
      sumX += x;
      sumY += y;
      visiblePixels += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (visiblePixels === 0) {
    return { centroid: null, boundingBox: null, visiblePixels: 0 };
  }

  const boundingBox: BoundingBox = {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    },
  };

  return {
    centroid: {
      x: sumX / visiblePixels,
      y: sumY / visiblePixels,
    },
    boundingBox,
    visiblePixels,
  };
};

export const parseHexColor = (hex: string): RgbColor => {
  const clean = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) throw new Error('COLOR_INVALID_HEX');
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
};

export const rgbToHex = ({ r, g, b }: RgbColor) =>
  `#${[r, g, b].map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`;

export const removeBackgroundByColor = (
  imageData: ImageData,
  target: RgbColor,
  tolerance: number,
) => {
  const output = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
  const { data } = output;
  for (let i = 0; i < data.length; i += 4) {
    const dr = data[i] - target.r;
    const dg = data[i + 1] - target.g;
    const db = data[i + 2] - target.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance <= tolerance) data[i + 3] = 0;
  }
  return output;
};

export const sampleImageDataColor = (imageData: ImageData, x: number, y: number): RgbColor => {
  const clampedX = Math.max(0, Math.min(imageData.width - 1, Math.round(x)));
  const clampedY = Math.max(0, Math.min(imageData.height - 1, Math.round(y)));
  const index = (clampedY * imageData.width + clampedX) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
  };
};

