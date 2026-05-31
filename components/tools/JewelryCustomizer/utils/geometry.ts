import opentype from 'opentype.js';
import Shape from '@doodle3d/clipper-js';

// Types for our geometry processing
export interface ProcessingConfig {
  // Units
  unitsPerMm: number;

  // Manufacturing rules (mm)
  kerfMm: number;
  offsetMm: number;
  minBridgeMm: number;
  bridgeMaxGapMm: number;
  flattenToleranceMm: number;

  // Typography (mm)
  letterSpacingMm: number;

  // Repair behavior
  autoTighten: boolean;
  autoTightenMaxMm: number;
  forceBridgeIfStillDisconnected?: boolean;

  // Hanging Loops (mm)
  loopType?: 'none' | 'top' | 'double_side' | 'double_top';
  loopOuterDiameterMm?: number;
  loopInnerDiameterMm?: number;

  // Backdrop Frame (mm)
  frameStyle?: 'none' | 'contour' | 'bar' | 'heart' | 'oval';
  framePaddingMm?: number;
}

export interface GeometryResult {
  originalPath: string; // SVG Path data
  processedPath: string; // SVG Path data after union/offset (combined for 2D view)
  polygons: number[][][]; // Combined polygons
  textPath: string; // Text-only SVG path
  framePath: string; // Frame-only SVG path
  textPolygons: number[][][]; // Text-only polygons
  framePolygons: number[][][]; // Frame-only polygons
  diagnostics: {
    componentsBeforeRepair: number;
    componentsAfterRepair: number;
    appliedLetterSpacingMm: number;
    usedBridgeCount: number;
  };
}

// Helper to load font
export const loadFont = async (url: string): Promise<opentype.Font> => {
  const cacheName = 'dev-tools-fonts';
  let response: Response;
  
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(url);
    if (cachedResponse) {
      response = cachedResponse;
    } else {
      response = await fetch(url, { mode: 'cors' });
      if (response.ok) {
        await cache.put(url, response.clone());
      }
    }
  } catch (e) {
    console.warn('Cache Storage API not available, falling back to direct fetch', e);
    response = await fetch(url, { mode: 'cors' });
  }

  if (!response.ok) {
    throw new Error(`Font request failed: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 4) {
    throw new Error('Font download too small');
  }

  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const isTrueType = bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00;
  const isOpenType = sig === 'OTTO';
  const isCollection = sig === 'ttcf';
  const isWoff = sig === 'wOFF' || sig === 'wOF2';
  if (!isTrueType && !isOpenType && !isCollection && !isWoff) {
    // Common failure mode: HTML error page (starts with "<!DO")
    const maybeText = new TextDecoder('utf-8').decode(bytes.slice(0, 32));
    throw new Error(`Unsupported font signature: ${sig}; head=${JSON.stringify(maybeText)}`);
  }

  return opentype.parse(buffer);
};

type IntPoint = { X: number; Y: number };

const makeCirclePath = (cx: number, cy: number, r: number, segments: number = 32): IntPoint[] => {
  const points: IntPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    points.push({
      X: Math.round(cx + r * Math.cos(angle)),
      Y: Math.round(cy + r * Math.sin(angle)),
    });
  }
  return points;
};

const makeRoundedRectPath = (left: number, top: number, right: number, bottom: number, r: number, segments: number = 8): IntPoint[] => {
  const points: IntPoint[] = [];
  const w = right - left;
  const h = bottom - top;
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  
  if (radius <= 0) {
    return [
      { X: left, Y: top },
      { X: right, Y: top },
      { X: right, Y: bottom },
      { X: left, Y: bottom }
    ];
  }

  // Top-Right corner
  for (let i = 0; i <= segments; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / (2 * segments);
    points.push({
      X: Math.round(right - radius + radius * Math.cos(angle)),
      Y: Math.round(top + radius + radius * Math.sin(angle)),
    });
  }
  // Bottom-Right corner
  for (let i = 0; i <= segments; i++) {
    const angle = (i * Math.PI) / (2 * segments);
    points.push({
      X: Math.round(right - radius + radius * Math.cos(angle)),
      Y: Math.round(bottom - radius + radius * Math.sin(angle)),
    });
  }
  // Bottom-Left corner
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / (2 * segments);
    points.push({
      X: Math.round(left + radius + radius * Math.cos(angle)),
      Y: Math.round(bottom - radius + radius * Math.sin(angle)),
    });
  }
  // Top-Left corner
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI + (i * Math.PI) / (2 * segments);
    points.push({
      X: Math.round(left + radius + radius * Math.cos(angle)),
      Y: Math.round(top + radius + radius * Math.sin(angle)),
    });
  }

  return points;
};

const makeEllipsePath = (cx: number, cy: number, rx: number, ry: number, segments: number = 64): IntPoint[] => {
  const points: IntPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    points.push({
      X: Math.round(cx + rx * Math.cos(angle)),
      Y: Math.round(cy + ry * Math.sin(angle)),
    });
  }
  return points;
};

const makeHeartPath = (cx: number, cy: number, rx: number, ry: number, segments: number = 80): IntPoint[] => {
  const points: IntPoint[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i * 2 * Math.PI) / segments;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    points.push({
      X: Math.round(cx + x * (rx / 16)),
      Y: Math.round(cy + y * (ry / 17)),
    });
  }
  return points;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type Bounds = { left: number; right: number; top: number; bottom: number };
type Vector = { x: number; y: number };

interface GlyphGeometry {
  char: string;
  lineIndex: number;
  charIndex: number;
  baselineY: number;
  advance: number;
  isWhitespace: boolean;
  rawPolys: number[][][];
  scaledPaths: IntPoint[][];
  shape: Shape | null;
  bounds: Bounds | null;
}

interface TextLayout {
  rawPolys: number[][][];
  scaledPolys: IntPoint[][];
  originalSvg: string;
  shape: Shape;
  glyphs: GlyphGeometry[];
}

const boundsOf = (poly: IntPoint[]): Bounds => {
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const p of poly) {
    if (p.X < left) left = p.X;
    if (p.X > right) right = p.X;
    if (p.Y < top) top = p.Y;
    if (p.Y > bottom) bottom = p.Y;
  }
  return { left, right, top, bottom };
};

const boundsContains = (outer: Bounds, inner: Bounds) =>
  outer.left <= inner.left && outer.right >= inner.right && outer.top <= inner.top && outer.bottom >= inner.bottom;

const boundsWidth = (bounds: Bounds) => Math.max(1, bounds.right - bounds.left);
const boundsHeight = (bounds: Bounds) => Math.max(1, bounds.bottom - bounds.top);

const unionBounds = (paths: IntPoint[][]): Bounds | null => {
  const points = paths.flat();
  if (points.length === 0) return null;
  return boundsOf(points);
};

// Signed area (positive/negative depends on winding). Use abs(area) for size.
const polygonArea = (poly: IntPoint[]): number => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.X * q.Y - q.X * p.Y;
  }
  return a / 2;
};

const pointInPolygon = (pt: IntPoint, poly: IntPoint[]): boolean => {
  // Ray casting; treats boundary as inside.
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].X;
    const yi = poly[i].Y;
    const xj = poly[j].X;
    const yj = poly[j].Y;

    // Check if point is on segment
    const dx = xj - xi;
    const dy = yj - yi;
    const px = pt.X - xi;
    const py = pt.Y - yi;
    const cross = dx * py - dy * px;
    if (Math.abs(cross) < 1e-6) {
      const dot = px * dx + py * dy;
      if (dot >= 0) {
        const len2 = dx * dx + dy * dy;
        if (dot <= len2) return true;
      }
    }

    const intersect = (yi > pt.Y) !== (yj > pt.Y) && pt.X < ((xj - xi) * (pt.Y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

// Group paths into components by outer-containment (outer + its holes = one component).
// This is a *practical* connectivity proxy for text: each letter is usually one outer contour with inner holes.
const getTextComponents = (shape: Shape): Shape[] => {
  const paths = (shape.paths as IntPoint[][]) ?? [];
  const polys = paths.filter((p) => p.length >= 3);
  const n = polys.length;
  if (n === 0) return [];

  const bbs = polys.map(boundsOf);
  const absAreas = polys.map((p) => Math.abs(polygonArea(p)));
  const parent: number[] = new Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    let bestParent = -1;
    let bestArea = Number.POSITIVE_INFINITY;
    const innerBB = bbs[i];

    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (absAreas[j] <= absAreas[i]) continue;
      if (!boundsContains(bbs[j], innerBB)) continue;
      if (!pointInPolygon(polys[i][0], polys[j])) continue;
      if (absAreas[j] < bestArea) {
        bestArea = absAreas[j];
        bestParent = j;
      }
    }

    parent[i] = bestParent;
  }

  const rootOf = (idx: number) => {
    let r = idx;
    while (parent[r] !== -1) r = parent[r];
    return r;
  };

  const groups = new Map<number, IntPoint[][]>();
  for (let i = 0; i < n; i++) {
    const r = rootOf(i);
    const arr = groups.get(r) ?? [];
    arr.push(polys[i]);
    groups.set(r, arr);
  }

  return Array.from(groups.values()).map((groupPaths) => new Shape(groupPaths, true, false, false, true));
};

// Convert Opentype Path to polygon point arrays (in the same coordinate units as the path)
const pathCommandsToPolygons = (path: opentype.Path, toleranceUnits: number): number[][][] => {
  const polygons: number[][][] = [];
  let currentPoly: number[][] = [];

  let lastX = 0;
  let lastY = 0;
  const addPoint = (x: number, y: number) => {
    if (currentPoly.length === 0) {
      currentPoly.push([x, y]);
      return;
    }
    const last = currentPoly[currentPoly.length - 1];
    if (Math.abs(last[0] - x) > 1e-3 || Math.abs(last[1] - y) > 1e-3) {
      currentPoly.push([x, y]);
    }
  };

  const estimateSteps = (distanceUnits: number) => {
    const tol = Math.max(0.05, toleranceUnits);
    return clamp(Math.ceil(distanceUnits / tol), 6, 48);
  };

  const sampleQuadratic = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
    const chord = Math.hypot(x2 - x0, y2 - y0);
    const steps = estimateSteps(chord);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
      const y = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
      addPoint(x, y);
    }
  };

  const sampleCubic = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) => {
    const chord = Math.hypot(x3 - x0, y3 - y0);
    const steps = estimateSteps(chord);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      const x =
        mt * mt * mt * x0 +
        3 * mt * mt * t * x1 +
        3 * mt * t * t * x2 +
        t * t * t * x3;
      const y =
        mt * mt * mt * y0 +
        3 * mt * mt * t * y1 +
        3 * mt * t * t * y2 +
        t * t * t * y3;
      addPoint(x, y);
    }
  };

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case 'M':
        if (currentPoly.length > 0) {
          polygons.push(currentPoly);
        }
        currentPoly = [];
        addPoint(cmd.x, cmd.y);
        lastX = cmd.x;
        lastY = cmd.y;
        break;
      case 'L':
        addPoint(cmd.x, cmd.y);
        lastX = cmd.x;
        lastY = cmd.y;
        break;
      case 'Q':
        sampleQuadratic(lastX, lastY, cmd.x1, cmd.y1, cmd.x, cmd.y);
        lastX = cmd.x;
        lastY = cmd.y;
        break;
      case 'C':
        sampleCubic(lastX, lastY, cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
        lastX = cmd.x;
        lastY = cmd.y;
        break;
      case 'Z':
        if (currentPoly.length > 0) {
          const first = currentPoly[0];
          // Ensure closed by checking if last point matches first
          const last = currentPoly[currentPoly.length - 1];
          if (Math.abs(last[0] - first[0]) > 1e-3 || Math.abs(last[1] - first[1]) > 1e-3) {
            currentPoly.push([first[0], first[1]]);
          }
        }
        break;
      default:
        break;
    }
  }

  if (currentPoly.length > 0) {
    polygons.push(currentPoly);
  }

  return polygons;
};

const toSvgPathData = (paths: IntPoint[][], scaleDown: number): { d: string; polygons: number[][][] } => {
  const polygons = paths.map((poly) => poly.map((p) => [p.X / scaleDown, p.Y / scaleDown]));
  const d = polygons
    .map((poly) => {
      if (poly.length === 0) return '';
      return `M ${poly[0][0]} ${poly[0][1]} ` + poly.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(' ') + ' Z';
    })
    .join(' ');
  return { d, polygons };
};

const polygonsToPathData = (polygons: number[][][], decimalPlaces: number = 2): string => {
  const floatToString = (v: number) => {
    const r = Number(v.toFixed(decimalPlaces));
    return Number.isInteger(r) ? String(r) : String(r);
  };

  return polygons
    .map((poly) => {
      if (poly.length === 0) return '';
      const [x0, y0] = poly[0];
      let d = `M ${floatToString(x0)} ${floatToString(y0)}`;
      for (let i = 1; i < poly.length; i++) {
        const [x, y] = poly[i];
        d += ` L ${floatToString(x)} ${floatToString(y)}`;
      }
      d += ' Z';
      return d;
    })
    .join(' ');
};

const bridgeGlyphDots = (
  scaledPaths: IntPoint[][],
  char: string,
  bridgeWidth: number
): IntPoint[][] => {
  if (!/[ij]/i.test(char)) return scaledPaths;
  if (scaledPaths.length <= 1) return scaledPaths;

  try {
    const glyphBounds = unionBounds(scaledPaths);
    if (!glyphBounds) return scaledPaths;
    const glyphHeight = boundsHeight(glyphBounds);

    const pathsWithBounds = scaledPaths.map(path => ({
      path,
      bounds: boundsOf(path),
      area: Math.abs(polygonArea(path))
    })).filter(p => p.area > 0);

    if (pathsWithBounds.length <= 1) return scaledPaths;

    const main = pathsWithBounds.reduce((best, p) => (p.area > best.area ? p : best), pathsWithBounds[0]);
    
    for (const part of pathsWithBounds) {
      if (part === main) continue;

      const isUpperDot = part.bounds.bottom < main.bounds.top || part.bounds.bottom < glyphBounds.top + glyphHeight * 0.55;
      if (!isUpperDot) continue;

      const cx = (part.bounds.left + part.bounds.right) / 2;
      const topY = (part.bounds.top + part.bounds.bottom) / 2;
      const stemHeight = main.bounds.bottom - main.bounds.top;
      const bottomY = main.bounds.top + Math.max(stemHeight * 0.2, bridgeWidth * 0.5);

      const hw = bridgeWidth * 0.45;
      const rectPoly: IntPoint[] = [
        { X: Math.round(cx - hw), Y: Math.round(topY) },
        { X: Math.round(cx + hw), Y: Math.round(topY) },
        { X: Math.round(cx + hw), Y: Math.round(bottomY) },
        { X: Math.round(cx - hw), Y: Math.round(bottomY) },
      ];

      scaledPaths.push(rectPoly);
    }
  } catch (e) {
    console.warn('Individual glyph dot bridging failed:', e);
  }

  return scaledPaths;
};

const buildTextLayout = (
  font: opentype.Font,
  text: string,
  size: number,
  letterSpacingUnits: number,
  flattenToleranceUnits: number,
  scaleUp: number,
  bridgeWidth: number
): TextLayout => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const lineHeight = size * 1.2;
  const glyphScale = size / font.unitsPerEm;
  const glyphs: GlyphGeometry[] = [];
  const rawPolys: number[][][] = [];
  const scaledPolys: IntPoint[][] = [];

  // Keep opentype.js glyph coordinates as SVG coordinates so preview/export are not mirrored.
  let y = size;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const chars = Array.from(lines[lineIndex]);
    const lineGlyphs = chars.map((char) => font.charToGlyph(char));
    let x = 0;

    for (let charIndex = 0; charIndex < chars.length; charIndex++) {
      const char = chars[charIndex];
      const glyph = lineGlyphs[charIndex];
      const glyphPath = glyph.getPath(x, y, size);
      const glyphRawPolys = pathCommandsToPolygons(glyphPath, flattenToleranceUnits);
      const glyphScaledPaths = glyphRawPolys
        .filter((poly) => poly.length >= 3)
        .map((poly) => poly.map((p) => ({ X: Math.round(p[0] * scaleUp), Y: Math.round(p[1] * scaleUp) })));
      
      // Perform dot bridging directly on the isolated glyph!
      const bridgedPaths = bridgeGlyphDots(glyphScaledPaths, char, bridgeWidth);

      const glyphShape = bridgedPaths.length > 0
        ? new Shape(bridgedPaths, true, false, false, true)
        : null;

      rawPolys.push(...glyphRawPolys);
      scaledPolys.push(...bridgedPaths);

      const advance = (glyph.advanceWidth ?? font.unitsPerEm) * glyphScale;
      const nextGlyph = lineGlyphs[charIndex + 1];
      const kerning = nextGlyph ? font.getKerningValue(glyph, nextGlyph) * glyphScale : 0;
      glyphs.push({
        char,
        lineIndex,
        charIndex,
        baselineY: y * scaleUp,
        advance: (advance + kerning + letterSpacingUnits) * scaleUp,
        isWhitespace: /\s/.test(char),
        rawPolys: glyphRawPolys,
        scaledPaths: glyphScaledPaths,
        shape: glyphShape,
        bounds: glyphScaledPaths.length > 0 ? unionBounds(glyphScaledPaths) : null,
      });

      x += advance + kerning + letterSpacingUnits;
    }

    y += lineHeight;
  }

  const shape = new Shape(scaledPolys, true, false, false, true);
  return {
    rawPolys,
    scaledPolys,
    originalSvg: polygonsToPathData(rawPolys, 2),
    shape,
    glyphs,
  };
};

const flattenShapePoints = (shape: Shape): IntPoint[] => {
  const points: IntPoint[] = [];
  for (const path of shape.paths as IntPoint[][]) {
    for (const p of path) points.push(p);
  }
  return points;
};

const samplePoints = (points: IntPoint[], maxSamples: number): IntPoint[] => {
  if (points.length <= maxSamples) return points;
  const step = Math.ceil(points.length / maxSamples);
  const out: IntPoint[] = [];
  for (let i = 0; i < points.length; i += step) out.push(points[i]);
  return out;
};

const normalize = (x: number, y: number): Vector => {
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len < 1e-6) return { x: 1, y: 0 };
  return { x: x / len, y: y / len };
};

const getOuterPaths = (paths: IntPoint[][]): IntPoint[][] => {
  const polys = paths.filter((p) => p.length >= 3);
  const bbs = polys.map(boundsOf);
  const absAreas = polys.map((p) => Math.abs(polygonArea(p)));
  return polys.filter((poly, i) => {
    for (let j = 0; j < polys.length; j++) {
      if (i === j) continue;
      if (absAreas[j] <= absAreas[i]) continue;
      if (!boundsContains(bbs[j], bbs[i])) continue;
      if (pointInPolygon(poly[0], polys[j])) return false;
    }
    return true;
  });
};

const getGlyphBodyPaths = (glyph: GlyphGeometry): IntPoint[][] => {
  if (!glyph.bounds) return [];
  const outerPaths = getOuterPaths(glyph.scaledPaths);
  if (outerPaths.length <= 1) return outerPaths;

  const largestArea = Math.max(...outerPaths.map((path) => Math.abs(polygonArea(path))));
  const glyphHeight = boundsHeight(glyph.bounds);
  const bodyPaths = outerPaths.filter((path) => {
    const bounds = boundsOf(path);
    const area = Math.abs(polygonArea(path));
    const isSmallUpperMark = area < largestArea * 0.18 && bounds.bottom < glyph.bounds!.top + glyphHeight * 0.46;
    return !isSmallUpperMark;
  });

  return bodyPaths.length > 0 ? bodyPaths : outerPaths;
};

const tangentAt = (path: IntPoint[], index: number): Vector => {
  const prev = path[(index - 2 + path.length) % path.length];
  const next = path[(index + 2) % path.length];
  return normalize(next.X - prev.X, next.Y - prev.Y);
};

interface BridgeCandidate {
  point: IntPoint;
  tangent: Vector;
  scoreBase: number;
}

const collectBridgeCandidates = (
  glyph: GlyphGeometry,
  side: 'exit' | 'entry',
  paths: IntPoint[][]
): BridgeCandidate[] => {
  if (!glyph.bounds || paths.length === 0) return [];
  const bounds = glyph.bounds;
  const width = boundsWidth(bounds);
  const height = boundsHeight(bounds);
  const targetY = clamp(glyph.baselineY - height * 0.28, bounds.top + height * 0.38, bounds.bottom - height * 0.12);

  const collect = (zoneRatio: number) => {
    const candidates: BridgeCandidate[] = [];
    for (const path of paths) {
      const step = Math.max(1, Math.floor(path.length / 90));
      for (let i = 0; i < path.length; i += step) {
        const point = path[i];
        const inZone = side === 'exit'
          ? point.X >= bounds.left + width * zoneRatio
          : point.X <= bounds.left + width * (1 - zoneRatio);
        if (!inZone) continue;

        const yNorm = Math.abs(point.Y - targetY) / height;
        const edgeNorm = side === 'exit'
          ? (bounds.right - point.X) / width
          : (point.X - bounds.left) / width;
        const upperPenalty = point.Y < bounds.top + height * 0.25 ? 1 : 0;
        const tangent = tangentAt(path, i);
        const horizontalPenalty = 1 - Math.abs(tangent.x);
        candidates.push({
          point,
          tangent,
          scoreBase: yNorm * 2.8 + Math.max(0, edgeNorm) * 1.7 + upperPenalty * 2.3 + horizontalPenalty * 0.25,
        });
      }
    }
    return candidates.sort((a, b) => a.scoreBase - b.scoreBase).slice(0, 48);
  };

  return collect(0.56).length >= 6 ? collect(0.56) : collect(0.42).length >= 6 ? collect(0.42) : collect(0);
};

const sampleCubicCenterline = (
  p0: IntPoint,
  p1: IntPoint,
  p2: IntPoint,
  p3: IntPoint,
  steps: number
): IntPoint[] => {
  const points: IntPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0.X +
      3 * mt * mt * t * p1.X +
      3 * mt * t * t * p2.X +
      t * t * t * p3.X;
    const y =
      mt * mt * mt * p0.Y +
      3 * mt * mt * t * p1.Y +
      3 * mt * t * t * p2.Y +
      t * t * t * p3.Y;
    const next = { X: Math.round(x), Y: Math.round(y) };
    const prev = points[points.length - 1];
    if (!prev || prev.X !== next.X || prev.Y !== next.Y) points.push(next);
  }
  return points;
};

const buildOpenStrokeShape = (centerline: IntPoint[], width: number, scaleUp: number): Shape | null => {
  if (centerline.length < 2) return null;
  try {
    const stroke = new Shape([centerline], false).offset(width / 2, {
      jointType: 'jtRound',
      endType: 'etOpenRound',
      roundPrecision: 0.18 * scaleUp,
    });
    return stroke.paths.length > 0 ? stroke : null;
  } catch {
    const bridge = buildCapsuleBridge(centerline[0], centerline[centerline.length - 1], width);
    return bridge.length >= 3 ? new Shape([bridge], true, false, false, true) : null;
  }
};

const buildSmoothBridgeShape = (
  start: BridgeCandidate,
  end: BridgeCandidate,
  width: number,
  scaleUp: number,
  preferredLift = 0
): Shape | null => {
  const dx = Math.max(end.point.X - start.point.X, width * 1.5);
  const dy = end.point.Y - start.point.Y;
  const overlap = Math.max(width * 0.7, 18);
  const startDir = normalize(Math.max(dx, 1), dy * 0.2);
  const endDir = normalize(Math.max(dx, 1), dy * 0.2);
  const p0 = {
    X: Math.round(start.point.X - startDir.x * overlap),
    Y: Math.round(start.point.Y - startDir.y * overlap),
  };
  const p3 = {
    X: Math.round(end.point.X + endDir.x * overlap),
    Y: Math.round(end.point.Y + endDir.y * overlap),
  };

  const lift = Math.min(Math.max(dx * 0.06 + preferredLift, 0), width * 1.2);
  const midY = Math.min(start.point.Y, end.point.Y) - lift;
  const c1 = {
    X: Math.round(start.point.X + dx * 0.42),
    Y: Math.round(start.point.Y + (midY - start.point.Y) * 0.28),
  };
  const c2 = {
    X: Math.round(end.point.X - dx * 0.42),
    Y: Math.round(end.point.Y + (midY - end.point.Y) * 0.28),
  };

  const steps = clamp(Math.ceil(Math.hypot(dx, dy) / Math.max(width * 0.45, 1)), 12, 36);
  return buildOpenStrokeShape(sampleCubicCenterline(p0, c1, c2, p3, steps), width, scaleUp);
};

const findClosestPointPair = (a: Shape, b: Shape): { a: IntPoint; b: IntPoint; dist2: number } | null => {
  const aPts = samplePoints(flattenShapePoints(a), 200);
  const bPts = samplePoints(flattenShapePoints(b), 200);
  if (aPts.length === 0 || bPts.length === 0) return null;

  let bestA = aPts[0];
  let bestB = bPts[0];
  let bestD2 = Number.POSITIVE_INFINITY;

  for (const pa of aPts) {
    for (const pb of bPts) {
      const dx = pa.X - pb.X;
      const dy = pa.Y - pb.Y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestA = pa;
        bestB = pb;
      }
    }
  }

  return { a: bestA, b: bestB, dist2: bestD2 };
};

const buildCapsuleBridge = (p: IntPoint, q: IntPoint, width: number): IntPoint[] => {
  const dx = q.X - p.X;
  const dy = q.Y - p.Y;
  const len = Math.hypot(dx, dy);

  // Handle touching or very close points
  if (!Number.isFinite(len) || len < 1) {
    const r = Math.max(width / 2, 10);
    return [
      { X: p.X - r, Y: p.Y - r },
      { X: p.X + r, Y: p.Y - r },
      { X: p.X + r, Y: p.Y + r },
      { X: p.X - r, Y: p.Y + r },
    ];
  }

  const r = width / 2;
  const ux = dx / len;
  const uy = dy / len;

  // Ensure the bridge overlaps into the shapes (avoid “just touching at a point”).
  const overlap = Math.max(r * 0.9, 20);
  const p2 = { X: p.X - ux * overlap, Y: p.Y - uy * overlap };
  const q2 = { X: q.X + ux * overlap, Y: q.Y + uy * overlap };

  const theta = Math.atan2(q2.Y - p2.Y, q2.X - p2.X);
  const steps = 12;

  const pts: IntPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const ang = theta + Math.PI / 2 - (i * Math.PI) / steps;
    pts.push({ X: Math.round(p2.X + r * Math.cos(ang)), Y: Math.round(p2.Y + r * Math.sin(ang)) });
  }
  for (let i = 0; i <= steps; i++) {
    const ang = theta - Math.PI / 2 + (i * Math.PI) / steps;
    pts.push({ X: Math.round(q2.X + r * Math.cos(ang)), Y: Math.round(q2.Y + r * Math.sin(ang)) });
  }
  return pts;
};

const safeCleanDedupe = (shape: Shape, fallback: Shape): Shape => {
  try {
    const cleaned = shape.clean(1).removeDuplicates();
    return cleaned.paths.length > 0 ? cleaned : shape.paths.length > 0 ? shape : fallback;
  } catch {
    return shape.paths.length > 0 ? shape : fallback;
  }
};

const normalizeClosedShape = (shape: Shape, fallback: Shape, scaleUp: number): Shape => {
  try {
    const normalized = shape.offset(0, {
      jointType: 'jtRound',
      endType: 'etClosedPolygon',
      roundPrecision: 0.25 * scaleUp,
    });
    return normalized.paths.length > 0 ? safeCleanDedupe(normalized, fallback) : safeCleanDedupe(shape, fallback);
  } catch {
    try {
      const normalized = shape.union(shape);
      return normalized.paths.length > 0 ? safeCleanDedupe(normalized, fallback) : safeCleanDedupe(shape, fallback);
    } catch {
      return safeCleanDedupe(shape, fallback);
    }
  }
};

const componentArea = (shape: Shape): number =>
  ((shape.paths as IntPoint[][]) ?? []).reduce((total, path) => total + Math.abs(polygonArea(path)), 0);

const textComponentCount = (shape: Shape): number => getTextComponents(shape).length;

const unionBridge = (merged: Shape, bridgeShape: Shape | null): Shape | null => {
  if (!bridgeShape || bridgeShape.paths.length === 0) return null;
  const unionResult = merged.union(bridgeShape);
  if (unionResult.paths.length === 0) return null;
  const next = safeCleanDedupe(unionResult, merged);
  return textComponentCount(next) < textComponentCount(merged) ? next : null;
};

const glyphsAlreadyConnected = (left: GlyphGeometry, right: GlyphGeometry): boolean => {
  if (!left.shape || !right.shape || !left.bounds || !right.bounds) return false;
  if (right.bounds.left - left.bounds.right <= 0) return true;
  try {
    const unionResult = left.shape.union(right.shape);
    return unionResult.paths.length > 0 && getTextComponents(safeCleanDedupe(unionResult, unionResult)).length <= 1;
  } catch {
    return false;
  }
};

const applyDotBridges = (
  initial: Shape,
  glyphs: GlyphGeometry[],
  bridgeWidth: number,
  maxGap: number,
  scaleUp: number
): { shape: Shape; count: number } => {
  let merged = initial;
  let count = 0;

  for (const glyph of glyphs) {
    if (!/[ij]/i.test(glyph.char)) continue;
    if (!glyph.shape || !glyph.bounds) continue;
    const components = getTextComponents(glyph.shape);
    if (components.length <= 1) continue;

    const parts = components
      .map((shape) => ({ shape, bounds: shape.shapeBounds() as Bounds, area: componentArea(shape) }))
      .filter((part) => part.area > 0);
    if (parts.length <= 1) continue;

    const main = parts.reduce((best, part) => (part.area > best.area ? part : best), parts[0]);
    for (const part of parts) {
      if (part === main) continue;
      
      // The dot is always in the upper portion
      const isUpperDot = part.bounds.bottom < main.bounds.top || part.bounds.bottom < glyph.bounds.top + boundsHeight(glyph.bounds) * 0.55;
      if (!isUpperDot) continue;

      try {
        // Draw a solid vertical rectangle connecting the dot and the stem
        const cx = (part.bounds.left + part.bounds.right) / 2;
        const topY = (part.bounds.top + part.bounds.bottom) / 2; // middle of the dot
        const stemHeight = main.bounds.bottom - main.bounds.top;
        const bottomY = main.bounds.top + Math.max(stemHeight * 0.2, bridgeWidth * 0.5); // extends into the stem
        
        const hw = bridgeWidth * 0.45; // bridge half-width
        const rectPoly: IntPoint[] = [
          { X: Math.round(cx - hw), Y: Math.round(topY) },    // top-left
          { X: Math.round(cx + hw), Y: Math.round(topY) },    // top-right
          { X: Math.round(cx + hw), Y: Math.round(bottomY) }, // bottom-right
          { X: Math.round(cx - hw), Y: Math.round(bottomY) }, // bottom-left
        ];

        // Directly push the rectangle path to merged.paths to bypass any Clipper union issues or winding mismatches,
        // then normalize it to resolve the overlapping contours.
        merged.paths.push(rectPoly);
        const resolved = normalizeClosedShape(merged, merged, scaleUp);
        if (resolved && resolved.paths.length > 0) {
          merged = resolved;
          count++;
        }
      } catch (e) {
        console.warn('Dot bridge rectangle weld failed:', e);
      }
    }
  }

  return { shape: merged, count };
};

const naturalPairScore = (
  left: GlyphGeometry,
  right: GlyphGeometry,
  start: BridgeCandidate,
  end: BridgeCandidate
): number => {
  const height = Math.max(boundsHeight(left.bounds!), boundsHeight(right.bounds!));
  const dx = end.point.X - start.point.X;
  const dy = end.point.Y - start.point.Y;
  const dist = Math.hypot(dx, dy);
  const desiredDy = -Math.max(dx, 0) * 0.045;
  const backwardsPenalty = dx < 0 ? Math.abs(dx) / height * 5 : 0;
  const yPenalty = Math.abs(dy - desiredDy) / height * 2.8;
  const lengthPenalty = dist / height * 0.58;
  const baseline = (left.baselineY + right.baselineY) / 2;
  const baselineTarget = baseline - height * 0.28;
  const baselinePenalty = (Math.abs(start.point.Y - baselineTarget) + Math.abs(end.point.Y - baselineTarget)) / height;
  return start.scoreBase + end.scoreBase + yPenalty + lengthPenalty + baselinePenalty * 0.7 + backwardsPenalty;
};

const findNaturalBridge = (
  left: GlyphGeometry,
  right: GlyphGeometry,
  bridgeWidth: number,
  maxGap: number,
  scaleUp: number
): Shape | null => {
  if (!left.bounds || !right.bounds || !left.shape || !right.shape) return null;
  const gap = right.bounds.left - left.bounds.right;
  if (gap <= bridgeWidth * 0.12 || gap > maxGap) return null;
  if (glyphsAlreadyConnected(left, right)) return null;

  const leftPaths = getGlyphBodyPaths(left);
  const rightPaths = getGlyphBodyPaths(right);
  const exits = collectBridgeCandidates(left, 'exit', leftPaths);
  const entries = collectBridgeCandidates(right, 'entry', rightPaths);
  if (exits.length === 0 || entries.length === 0) return null;

  let best: { start: BridgeCandidate; end: BridgeCandidate; score: number } | null = null;
  for (const start of exits) {
    for (const end of entries) {
      const dx = end.point.X - start.point.X;
      const dist = Math.hypot(dx, end.point.Y - start.point.Y);
      if (dx < -bridgeWidth * 1.5) continue;
      if (dist > Math.max(maxGap + bridgeWidth * 2, bridgeWidth * 5)) continue;
      const score = naturalPairScore(left, right, start, end);
      if (!best || score < best.score) best = { start, end, score };
    }
  }

  return best ? buildSmoothBridgeShape(best.start, best.end, bridgeWidth, scaleUp, bridgeWidth * 0.1) : null;
};

const glyphBridgePairs = (glyphs: GlyphGeometry[], maxGap: number): Array<[GlyphGeometry, GlyphGeometry]> => {
  const pairs: Array<[GlyphGeometry, GlyphGeometry]> = [];
  const lineIndexes = Array.from(new Set(glyphs.map((glyph) => glyph.lineIndex)));
  for (const lineIndex of lineIndexes) {
    const lineGlyphs = glyphs
      .filter((glyph) => glyph.lineIndex === lineIndex)
      .sort((a, b) => a.charIndex - b.charIndex);
    let previousVisible: GlyphGeometry | null = null;
    let crossedSpace = false;

    for (const glyph of lineGlyphs) {
      if (glyph.isWhitespace || !glyph.bounds) {
        crossedSpace = true;
        continue;
      }

      if (previousVisible?.bounds) {
        const gap = glyph.bounds.left - previousVisible.bounds.right;
        if (!crossedSpace || gap <= maxGap) pairs.push([previousVisible, glyph]);
      }

      previousVisible = glyph;
      crossedSpace = false;
    }
  }
  return pairs;
};

const applyNaturalGlyphBridges = (
  initial: Shape,
  glyphs: GlyphGeometry[],
  bridgeWidth: number,
  maxGap: number,
  scaleUp: number
): { shape: Shape; count: number } => {
  let merged = initial;
  let count = 0;

  for (const [left, right] of glyphBridgePairs(glyphs, maxGap)) {
    const next = unionBridge(merged, findNaturalBridge(left, right, bridgeWidth, maxGap, scaleUp));
    if (next) {
      merged = next;
      count++;
    }
  }

  return { shape: merged, count };
};

const buildDirectBridgeShape = (start: IntPoint, end: IntPoint, width: number): Shape | null => {
  const bridge = buildCapsuleBridge(start, end, width);
  return bridge.length >= 3 ? new Shape([bridge], true, false, false, true) : null;
};

const applyGuaranteedFallbackBridges = (
  initial: Shape,
  bridgeWidth: number,
  maxGap: number
): { shape: Shape; count: number } => {
  let merged = initial;
  let count = 0;
  const softMaxGap = Math.max(maxGap, bridgeWidth * 6);

  for (let attempt = 0; attempt < 48; attempt++) {
    const parts = getTextComponents(merged);
    if (parts.length <= 1) break;

    const partsWithBounds = parts
      .map((shape) => ({ shape, bounds: shape.shapeBounds() as Bounds }))
      .sort((a, b) => a.bounds.left - b.bounds.left);

    let best: { a: IntPoint; b: IntPoint; dist2: number } | null = null;
    for (let i = 0; i < partsWithBounds.length - 1; i++) {
      const pair = findClosestPointPair(partsWithBounds[i].shape, partsWithBounds[i + 1].shape);
      if (!pair) continue;
      if (!best || pair.dist2 < best.dist2) best = pair;
    }

    if (!best) break;
    const gap = Math.sqrt(best.dist2);
    const directWidth = gap > softMaxGap ? Math.max(bridgeWidth, gap * 0.18) : bridgeWidth;
    const next = unionBridge(merged, buildDirectBridgeShape(best.a, best.b, directWidth));
    if (!next) break;

    merged = next;
    count++;
  }

  return { shape: merged, count };
};

// Main processing function
export const generateGeometry = (
  text: string,
  font: opentype.Font,
  size: number,
  config: ProcessingConfig
): GeometryResult => {
  const safeText = (text ?? '').trimEnd();
  const unitsPerMm = Math.max(0.1, config.unitsPerMm);
  const scaleUp = 1000;

  const flattenTolUnits = Math.max(0.05, config.flattenToleranceMm * unitsPerMm);
  const baseLetterSpacingUnits = config.letterSpacingMm * unitsPerMm;
  const maxTightenUnits = Math.max(0, config.autoTightenMaxMm * unitsPerMm);
  const bridgeWidth = Math.max(0.1, config.minBridgeMm) * unitsPerMm * scaleUp;

  const tryBuildShape = (letterSpacingUnits: number) => {
    return buildTextLayout(font, safeText, size, letterSpacingUnits, flattenTolUnits, scaleUp, bridgeWidth);
  };

  if (!font || safeText.length === 0) {
    return {
      originalPath: '',
      processedPath: '',
      polygons: [],
      textPath: '',
      framePath: '',
      textPolygons: [],
      framePolygons: [],
      diagnostics: {
        componentsBeforeRepair: 0,
        componentsAfterRepair: 0,
        appliedLetterSpacingMm: config.letterSpacingMm,
        usedBridgeCount: 0,
      },
    };
  }

  // 1) Build initial shape
  let appliedLetterSpacingUnits = baseLetterSpacingUnits;
  const buildResult = tryBuildShape(appliedLetterSpacingUnits);
  let { originalSvg } = buildResult;
  let { shape, rawPolys } = buildResult;
  let glyphs = buildResult.glyphs;

  // If no polygons, return early
  if (rawPolys.length === 0 || shape.paths.length === 0) {
    return {
      originalPath: originalSvg,
      processedPath: '',
      polygons: [],
      textPath: '',
      framePath: '',
      textPolygons: [],
      framePolygons: [],
      diagnostics: {
        componentsBeforeRepair: 0,
        componentsAfterRepair: 0,
        appliedLetterSpacingMm: config.letterSpacingMm,
        usedBridgeCount: 0,
      },
    };
  }

  // 2) For processedPath, we'll directly use the rawPolys with offset
  // Skip complex Clipper operations that might return empty results
  // Just apply offset directly to the shape
  let merged = shape;
  
  // Normalize raw font contours into closed components before connectivity repair.
  merged = normalizeClosedShape(shape, shape, scaleUp);
  
  const componentsBefore = getTextComponents(merged).length;

  // 3) Auto tighten letter spacing if requested
  if (config.autoTighten && componentsBefore > 1 && maxTightenUnits > 0) {
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const tighten = (-maxTightenUnits * i) / steps;
      const candidateLetterSpacingUnits = baseLetterSpacingUnits + tighten;
      const candidate = tryBuildShape(candidateLetterSpacingUnits);
      const candidateMerged = normalizeClosedShape(candidate.shape, candidate.shape, scaleUp);
      if (textComponentCount(candidateMerged) <= 1) {
        appliedLetterSpacingUnits = candidateLetterSpacingUnits;
        originalSvg = candidate.originalSvg;
        shape = candidate.shape;
        rawPolys = candidate.rawPolys;
        glyphs = candidate.glyphs;
        merged = candidateMerged;
        break;
      }
    }
  }

  // 4) Bridge repair: first use glyph order and baseline-aware smooth joins.
  const maxGap = Math.max(0, config.bridgeMaxGapMm) * unitsPerMm * scaleUp;
  let usedBridgeCount = 0;

  const dotRepair = applyDotBridges(merged, glyphs, bridgeWidth, maxGap, scaleUp);
  merged = dotRepair.shape;
  usedBridgeCount += dotRepair.count;

  const naturalRepair = applyNaturalGlyphBridges(merged, glyphs, bridgeWidth, maxGap, scaleUp);
  merged = naturalRepair.shape;
  usedBridgeCount += naturalRepair.count;

  // 4.5) Hard guarantee: keep joining the remaining visible text components until
  // the design is one manufacturable piece.
  const forceBridge = config.forceBridgeIfStillDisconnected ?? true;
  if (forceBridge && textComponentCount(merged) > 1) {
    const fallbackRepair = applyGuaranteedFallbackBridges(merged, bridgeWidth, maxGap);
    merged = fallbackRepair.shape;
    usedBridgeCount += fallbackRepair.count;
  }

  // 4.8) Last resort: morphological closing to merge “almost touching” parts.
  // This helps when Clipper considers a bridge as point-touch and still keeps components separate.
  if (forceBridge && merged.paths.length > 0 && textComponentCount(merged) > 1) {
    try {
      const closeR = Math.max(bridgeWidth * 0.6, 20);
      const grown = merged.offset(closeR, {
        jointType: 'jtRound',
        endType: 'etClosedPolygon',
        roundPrecision: 0.25 * scaleUp,
      });
      if (grown.paths.length > 0) {
        const shrunk = grown.offset(-closeR, {
          jointType: 'jtRound',
          endType: 'etClosedPolygon',
          roundPrecision: 0.25 * scaleUp,
        });
        if (shrunk.paths.length > 0) {
          merged = safeCleanDedupe(shrunk, merged);
        }
      }
    } catch {
      // ignore
    }
  }

  // Safety: never allow merged to become empty after repairs.
  if (merged.paths.length === 0) merged = shape;

  // 5) Offset (thicken) AFTER bridging
  const offset = Math.max(0, config.offsetMm) * unitsPerMm * scaleUp;
  let offsetShape = merged;
  
  if (offset > 0 && merged.paths.length > 0) {
    try {
      const offsetResult = merged.offset(offset, { 
        jointType: 'jtRound', 
        endType: 'etClosedPolygon', 
        roundPrecision: 0.25 * scaleUp 
      });
      if (offsetResult.paths.length > 0) {
        offsetShape = safeCleanDedupe(offsetResult, merged);
      }
    } catch (e) {
      console.warn('Offset failed, using original shape:', e);
    }
  }
  // If the shape unexpectedly ends up empty, fall back to repaired (merged) before raw.
  const finalTextPaths = offsetShape.paths as IntPoint[][];
  let textPolygons: number[][][];
  let textPath: string;

  if (finalTextPaths.length === 0) {
    const repairedPaths = (merged.paths as IntPoint[][]) ?? [];
    if (repairedPaths.length > 0) {
      const result = toSvgPathData(repairedPaths, scaleUp);
      textPath = result.d;
      textPolygons = result.polygons;
    } else {
      textPolygons = rawPolys;
      textPath = polygonsToPathData(rawPolys, 2);
    }
  } else {
    const result = toSvgPathData(finalTextPaths, scaleUp);
    textPath = result.d;
    textPolygons = result.polygons;
  }

  // Calculate backdrop frame and loops
  const textBounds = unionBounds(finalTextPaths.length > 0 ? finalTextPaths : merged.paths as IntPoint[][]) || { left: 0, right: 1000, top: 0, bottom: 1000 };
  const textWidth = textBounds.right - textBounds.left;
  const textHeight = textBounds.bottom - textBounds.top;
  const textCenterX = (textBounds.left + textBounds.right) / 2;
  const textCenterY = (textBounds.top + textBounds.bottom) / 2;

  let frameShape = new Shape([], true);
  const framePadding = Math.max(0, config.framePaddingMm ?? 2.0) * unitsPerMm * scaleUp;

  if (config.frameStyle === 'contour') {
    // Bubble contour
    try {
      const baseToContour = finalTextPaths.length > 0 ? offsetShape : merged;
      const contourResult = baseToContour.offset(framePadding, {
        jointType: 'jtRound',
        endType: 'etClosedPolygon',
        roundPrecision: 0.25 * scaleUp,
      });
      if (contourResult.paths.length > 0) {
        frameShape = safeCleanDedupe(contourResult, frameShape);
      }
    } catch (e) {
      console.warn('Contour framing failed:', e);
    }
  } else if (config.frameStyle === 'bar') {
    // Rounded rectangular plate
    const barPath = makeRoundedRectPath(
      textBounds.left - framePadding,
      textBounds.top - framePadding,
      textBounds.right + framePadding,
      textBounds.bottom + framePadding,
      framePadding * 0.8
    );
    frameShape = new Shape([barPath], true);
  } else if (config.frameStyle === 'oval') {
    // Oval plate
    const rx = textWidth / 2 + framePadding;
    const ry = textHeight / 2 + framePadding;
    const ovalPath = makeEllipsePath(textCenterX, textCenterY, rx, ry);
    frameShape = new Shape([ovalPath], true);
  } else if (config.frameStyle === 'heart') {
    // Heart plate
    const rx = textWidth / 2 + framePadding * 1.2;
    const ry = textHeight / 2 + framePadding * 1.2;
    const heartPath = makeHeartPath(textCenterX, textCenterY, rx, ry);
    frameShape = new Shape([heartPath], true);
  }

  const hasFrame = config.frameStyle !== 'none' && frameShape.paths.length > 0;
  let baseShapeForLoops = hasFrame ? frameShape : (finalTextPaths.length > 0 ? offsetShape : merged);

  // Generate loops using a STEM + RING approach so the bail is always one solid piece:
  //   1. A rectangular "stem" is unioned into the body first (acts as the neck/bridge)
  //   2. A full outer-circle ring is unioned on top of the stem
  //   3. An inner circle (chain hole) is punched only from the ring area
  //   This ensures the hole never severs the connection between bail and body.
  if (config.loopType && config.loopType !== 'none') {
    const loopOuterR = (Math.max(1, config.loopOuterDiameterMm ?? 4.0) / 2) * unitsPerMm * scaleUp;
    const loopInnerR = (Math.max(0.5, config.loopInnerDiameterMm ?? 2.0) / 2) * unitsPerMm * scaleUp;
    // Stem dimensions: width = ring width (outer-inner), height = loopOuterR (half a diameter)
    const ringThickness = loopOuterR - loopInnerR;
    const stemW = Math.max(ringThickness, loopOuterR * 0.6);  // stem width
    const stemH = loopOuterR;                                   // stem height (sticks up from body)

    const boundsForLoops = hasFrame ? (frameShape.shapeBounds() as Bounds) : textBounds;
    const lWidth = boundsForLoops.right - boundsForLoops.left;
    const lCenterY = (boundsForLoops.top + boundsForLoops.bottom) / 2;

    // Helper: Find the top Y coordinate and center X of the individual glyph closest horizontally to a given cx
    const getClosestGlyphTop = (cx: number, fallbackY: number): { top: number, cx: number } => {
      const validGlyphs = glyphs.filter((g) => g.bounds && !g.isWhitespace);
      if (validGlyphs.length === 0) return { top: fallbackY, cx };

      let closestGlyph = validGlyphs[0];
      let minDistance = Number.POSITIVE_INFINITY;

      for (const g of validGlyphs) {
        const bounds = g.bounds as Bounds;
        const gCx = (bounds.left + bounds.right) / 2;
        const dist = Math.abs(gCx - cx);
        if (dist < minDistance) {
          minDistance = dist;
          closestGlyph = g;
        }
      }

      const bestBounds = closestGlyph.bounds as Bounds;
      const bestCx = (bestBounds.left + bestBounds.right) / 2;
      return { top: bestBounds.top, cx: bestCx };
    };

    // Helper: build stem polygon with CLOCKWISE (CW) winding order so Clipper treats it as solid
    const makeStemPoly = (cx: number, bodyEdge: number, dir: 'up' | 'left' | 'right', overlap: number): IntPoint[] => {

      if (dir === 'up') {
        const hw = stemW / 2;
        return [
          { X: Math.round(cx - hw), Y: Math.round(bodyEdge - stemH) },  // top-left
          { X: Math.round(cx + hw), Y: Math.round(bodyEdge - stemH) },  // top-right
          { X: Math.round(cx + hw), Y: Math.round(bodyEdge + overlap) }, // bottom-right
          { X: Math.round(cx - hw), Y: Math.round(bodyEdge + overlap) }, // bottom-left
        ];
      } else if (dir === 'left') {
        const hh = stemW / 2;
        return [
          { X: Math.round(bodyEdge - overlap), Y: Math.round(lCenterY - hh) }, // top-left
          { X: Math.round(bodyEdge + stemH),   Y: Math.round(lCenterY - hh) }, // top-right
          { X: Math.round(bodyEdge + stemH),   Y: Math.round(lCenterY + hh) }, // bottom-right
          { X: Math.round(bodyEdge - overlap), Y: Math.round(lCenterY + hh) }, // bottom-left
        ];
      } else { // right
        const hh = stemW / 2;
        return [
          { X: Math.round(bodyEdge - stemH),   Y: Math.round(lCenterY - hh) }, // top-left
          { X: Math.round(bodyEdge + overlap), Y: Math.round(lCenterY - hh) }, // top-right
          { X: Math.round(bodyEdge + overlap), Y: Math.round(lCenterY + hh) }, // bottom-right
          { X: Math.round(bodyEdge - stemH),   Y: Math.round(lCenterY + hh) }, // bottom-left
        ];
      }
    };

    // Helper: add one bail at position (ringCx, ringCy) – ring center above/beside body
    const addOneBail = (ringCx: number, ringCy: number, dir: 'up' | 'left' | 'right', bodyEdge: number, cx: number) => {
      const outerCircle = makeCirclePath(ringCx, ringCy, loopOuterR);
      const innerCircle = makeCirclePath(ringCx, ringCy, loopInnerR);

      let punchedShape: Shape | null = null;
      const initialComponents = getTextComponents(baseShapeForLoops).length;

      // Dynamically attempt welding with increasing overlaps to guarantee connection
      let currentOverlap = loopOuterR * 0.4;
      const stepSize = loopOuterR * 0.4;

      for (let attempt = 0; attempt < 6; attempt++) {
        const stem = makeStemPoly(cx, bodyEdge, dir, currentOverlap);
        try {
          // Step 1: union stem into body
          const stemShape = new Shape([stem], true, false, false, true);
          const withStem = baseShapeForLoops.union(stemShape);
          if (withStem.paths.length === 0) {
            currentOverlap += stepSize;
            continue;
          }

          // Step 2: union outer ring circle
          const outerRingShape = new Shape([outerCircle], true, false, false, true);
          const withRing = withStem.union(outerRingShape);
          if (withRing.paths.length === 0) {
            currentOverlap += stepSize;
            continue;
          }

          // Step 3: punch the inner hole
          const innerHoleShape = new Shape([innerCircle], true, false, false, true);
          const punched = withRing.difference(innerHoleShape);

          if (punched.paths.length > 0) {
            punchedShape = punched;
            const currentComponents = getTextComponents(punched).length;
            if (currentComponents <= initialComponents) {
              // Successfully connected and didn't introduce new floating components!
              break;
            }
          }
        } catch (e) {
          console.warn(`Bail weld attempt ${attempt} failed:`, e);
        }
        currentOverlap += stepSize;
      }

      // If the stem union failed to connect (e.g. gaps between characters or deep valleys like 'V'),
      // fallback to a highly aggressive overlapping ring and a long thick stem to force connection.
      if (punchedShape && getTextComponents(punchedShape).length > initialComponents) {
        try {
          // Calculate direct overlap center Y/X such that inner circle bottom doesn't touch the body,
          // but the outer circle overlaps heavily
          let safeCx = ringCx;
          let safeCy = ringCy;
          const safeInnerR = Math.min(loopInnerR, loopOuterR * 0.8);
          
          let longStemPoly: IntPoint[] = [];

          if (dir === 'up') {
            safeCy = bodyEdge - safeInnerR; // Push it deep
            const hugeOverlap = loopOuterR * 4; // Long stem
            longStemPoly = makeStemPoly(cx, bodyEdge, dir, hugeOverlap);
          } else if (dir === 'left') {
            safeCx = bodyEdge - safeInnerR;
            const hugeOverlap = loopOuterR * 4;
            longStemPoly = makeStemPoly(cx, bodyEdge, dir, hugeOverlap);
          } else { // right
            safeCx = bodyEdge + safeInnerR;
            const hugeOverlap = loopOuterR * 4;
            longStemPoly = makeStemPoly(cx, bodyEdge, dir, hugeOverlap);
          }

          const directOuter = makeCirclePath(safeCx, safeCy, loopOuterR);
          const directInner = makeCirclePath(safeCx, safeCy, safeInnerR);

          const directOuterShape = new Shape([directOuter], true, false, false, true);
          const directInnerShape = new Shape([directInner], true, false, false, true);
          const ring = directOuterShape.difference(directInnerShape);
          
          const longStemShape = new Shape([longStemPoly], true, false, false, true);
          const ringWithStem = ring.union(longStemShape);
          
          punchedShape = baseShapeForLoops.union(ringWithStem);
        } catch (e) {
          console.warn('Fallback direct bail weld failed:', e);
        }
      }

      if (punchedShape) {
        baseShapeForLoops = safeCleanDedupe(punchedShape, baseShapeForLoops);
      }
    };

    if (config.loopType === 'top') {
      const targetCx = (boundsForLoops.left + boundsForLoops.right) / 2;
      const { top: bodyTop, cx: ringCx } = getClosestGlyphTop(targetCx, boundsForLoops.top);
      const ringCy = bodyTop - stemH - loopOuterR * 0.1; // ring center sits above stem
      
      addOneBail(ringCx, ringCy, 'up', bodyTop, ringCx);
    } else if (config.loopType === 'double_side') {
      // For double loops, place them on the left and right sides
      {
        const cx = boundsForLoops.left - stemH - loopOuterR * 0.1;
        addOneBail(cx, lCenterY, 'left', boundsForLoops.left, lCenterY);
      }
      
      {
        const cx = boundsForLoops.right + stemH + loopOuterR * 0.1;
        addOneBail(cx, lCenterY, 'right', boundsForLoops.right, lCenterY);
      }
    } else if (config.loopType === 'double_top') {
      // Place two loops on the top edge, roughly 15% inwards from edges
      const x1 = boundsForLoops.left + lWidth * 0.15;
      const x2 = boundsForLoops.right - lWidth * 0.15;
      
      const { top: bodyTop1 } = getClosestGlyphTop(x1, boundsForLoops.top);
      const { top: bodyTop2 } = getClosestGlyphTop(x2, boundsForLoops.top);
      
      const ringCy1 = bodyTop1 - stemH - loopOuterR * 0.1;
      const ringCy2 = bodyTop2 - stemH - loopOuterR * 0.1;
      
      addOneBail(x1, ringCy1, 'up', bodyTop1, x1);
      addOneBail(x2, ringCy2, 'up', bodyTop2, x2);
    }

  }

  if (hasFrame) {
    frameShape = baseShapeForLoops;
  } else {
    offsetShape = baseShapeForLoops;
  }

  // 1. Calculate overall combined bounds to find center of the finished piece
  const finalMergedShape = hasFrame ? frameShape : offsetShape;
  const finalBounds = unionBounds(finalMergedShape.paths as IntPoint[][]) || { left: 0, right: 1000, top: 0, bottom: 1000 };
  const finalCenterX = (finalBounds.left + finalBounds.right) / 2;
  const finalCenterY = (finalBounds.top + finalBounds.bottom) / 2;

  // 2. Define a translation helper
  const translatePaths = (paths: IntPoint[][], tx: number, ty: number): IntPoint[][] => {
    return paths.map(path => path.map(pt => ({
      X: pt.X + tx,
      Y: pt.Y + ty
    })));
  };

  // Center all shapes by translating them so their combined center is at (0, 0)
  const tx = -finalCenterX;
  const ty = -finalCenterY;

  const centeredTextPaths = translatePaths(offsetShape.paths as IntPoint[][], tx, ty);
  const centeredFramePaths = hasFrame ? translatePaths(frameShape.paths as IntPoint[][], tx, ty) : [];

  // 3. Generate SVG path and polygon outputs from centered coordinates
  const textResult = toSvgPathData(centeredTextPaths, scaleUp);
  textPath = textResult.d;
  textPolygons = textResult.polygons;

  let framePath = '';
  let framePolygons: number[][][] = [];
  if (hasFrame && centeredFramePaths.length > 0) {
    const frameResult = toSvgPathData(centeredFramePaths, scaleUp);
    framePath = frameResult.d;
    framePolygons = frameResult.polygons;
  }

  // Combined path and polygons represent both text and backing plate overlays
  const combinedPolygons = [...framePolygons, ...textPolygons];
  const combinedPath = [framePath, textPath].filter(Boolean).join(' ');

  return {
    originalPath: originalSvg,
    processedPath: combinedPath,
    polygons: combinedPolygons,
    textPath,
    framePath,
    textPolygons,
    framePolygons,
    diagnostics: {
      componentsBeforeRepair: componentsBefore,
      componentsAfterRepair: textComponentCount(merged),
      appliedLetterSpacingMm: appliedLetterSpacingUnits / unitsPerMm,
      usedBridgeCount,
    },
  };
};
