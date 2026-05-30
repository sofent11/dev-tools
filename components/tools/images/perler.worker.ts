// perler.worker.ts

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface PaletteEntry {
  color: RgbColor;
  hex: string;
  count: number;
}

interface BeadPatternResult {
  size: number;
  palette: PaletteEntry[];
  matrix: number[][];
}

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;

const getDistanceSquared = (first: RgbColor, second: RgbColor) => {
  const red = first.r - second.r;
  const green = first.g - second.g;
  const blue = first.b - second.b;
  return red * red + green * green + blue * blue;
};

const averageColors = (colors: RgbColor[]): RgbColor => {
  if (!colors.length) return { r: 255, g: 255, b: 255 };

  const total = colors.reduce(
    (acc, color) => ({
      r: acc.r + color.r,
      g: acc.g + color.g,
      b: acc.b + color.b,
    }),
    { r: 0, g: 0, b: 0 },
  );

  return {
    r: Math.round(total.r / colors.length),
    g: Math.round(total.g / colors.length),
    b: Math.round(total.b / colors.length),
  };
};

const getBucketRange = (colors: RgbColor[]) => {
  const range = colors.reduce(
    (acc, color) => ({
      minR: Math.min(acc.minR, color.r),
      maxR: Math.max(acc.maxR, color.r),
      minG: Math.min(acc.minG, color.g),
      maxG: Math.max(acc.maxG, color.g),
      minB: Math.min(acc.minB, color.b),
      maxB: Math.max(acc.maxB, color.b),
    }),
    {
      minR: 255,
      maxR: 0,
      minG: 255,
      maxG: 0,
      minB: 255,
      maxB: 0,
    },
  );

  const red = range.maxR - range.minR;
  const green = range.maxG - range.minG;
  const blue = range.maxB - range.minB;
  const channel = red >= green && red >= blue ? 'r' : green >= blue ? 'g' : 'b';

  return {
    channel,
    spread: Math.max(red, green, blue),
  };
};

const quantizeMedianCut = (pixels: RgbColor[], maxColors: number) => {
  const buckets: RgbColor[][] = [pixels.slice()];

  while (buckets.length < maxColors) {
    let splitIndex = -1;
    let splitScore = -1;
    let splitChannel: keyof RgbColor = 'r';

    buckets.forEach((bucket, index) => {
      if (bucket.length < 2) return;
      const range = getBucketRange(bucket);
      const score = range.spread * bucket.length;

      if (score > splitScore) {
        splitIndex = index;
        splitScore = score;
        splitChannel = range.channel as keyof RgbColor;
      }
    });

    if (splitIndex < 0) break;

    const sorted = buckets[splitIndex].slice().sort((a, b) => a[splitChannel] - b[splitChannel]);
    const middle = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, middle);
    const second = sorted.slice(middle);

    if (!first.length || !second.length) break;
    buckets.splice(splitIndex, 1, first, second);
  }

  return buckets.map(averageColors);
};

const getNearestPaletteIndex = (color: RgbColor, palette: RgbColor[]) => {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  palette.forEach((paletteColor, index) => {
    const distance = getDistanceSquared(color, paletteColor);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
};

self.onmessage = (event: MessageEvent<{ pixels: RgbColor[]; size: number; maxColors: number }>) => {
  const { pixels, size, maxColors } = event.data;

  try {
    const palette = quantizeMedianCut(pixels, maxColors);
    const rawIndexes = pixels.map(pixel => getNearestPaletteIndex(pixel, palette));
    const counts = new Array(palette.length).fill(0) as number[];
    rawIndexes.forEach(index => {
      counts[index] += 1;
    });

    const sortedEntries = palette
      .map((color, index) => ({
        color,
        count: counts[index],
        originalIndex: index,
      }))
      .filter(entry => entry.count > 0)
      .sort((a, b) => b.count - a.count);

    const indexMap = new Map<number, number>();
    sortedEntries.forEach((entry, index) => indexMap.set(entry.originalIndex, index));

    const result: BeadPatternResult = {
      size,
      palette: sortedEntries.map(entry => ({
        color: entry.color,
        hex: rgbToHex(entry.color.r, entry.color.g, entry.color.b),
        count: entry.count,
      })),
      matrix: Array.from({ length: size }, (_, row) =>
        Array.from({ length: size }, (_, column) => indexMap.get(rawIndexes[row * size + column]) ?? 0),
      ),
    };

    self.postMessage({ type: 'success', result });
  } catch (error) {
    self.postMessage({ type: 'error', error: error instanceof Error ? error.message : String(error) });
  }
};
