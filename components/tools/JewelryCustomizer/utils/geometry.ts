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
}

export interface GeometryResult {
  originalPath: string; // SVG Path data
  processedPath: string; // SVG Path data after union/offset
  polygons: number[][][]; // Raw polygons for debugging/export
  diagnostics: {
    componentsBeforeRepair: number;
    componentsAfterRepair: number;
    appliedLetterSpacingMm: number;
    usedBridgeCount: number;
  };
}

// Helper to load font
export const loadFont = async (url: string): Promise<opentype.Font> => {
  const response = await fetch(url, { mode: 'cors' });
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type Bounds = { left: number; right: number; top: number; bottom: number };

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

const buildTextPath = (
  font: opentype.Font,
  text: string,
  size: number,
  letterSpacingUnits: number
): opentype.Path => {
  const path = new opentype.Path();
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const lineHeight = size * 1.2;

  // Font coordinate: Y goes up (baseline at 0, ascender positive).
  // We'll build the path in font coords, then flip Y in pathCommandsToPolygons.
  let y = size; // Start at ascender height so text is below y=0 after flip
  for (const line of lines) {
    let x = 0;
    const glyphs = font.stringToGlyphs(line);
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      const glyphPath = glyph.getPath(x, y, size);
      path.extend(glyphPath);

      const advance = (glyph.advanceWidth ?? font.unitsPerEm) * (size / font.unitsPerEm);
      const nextGlyph = glyphs[i + 1];
      const kerning = nextGlyph ? font.getKerningValue(glyph, nextGlyph) * (size / font.unitsPerEm) : 0;
      x += advance + kerning + letterSpacingUnits;
    }
    y += lineHeight;
  }

  return path;
};

// Convert Opentype Path to polygon point arrays (in the same coordinate units as the path)
const pathCommandsToPolygons = (path: opentype.Path, toleranceUnits: number): number[][][] => {
  const polygons: number[][][] = [];
  let currentPoly: number[][] = [];

  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;

  // Flip Y: font coords are Y-up, canvas is Y-down.
  const addPoint = (x: number, y: number) => {
    const flippedY = -y; // Flip Y axis
    if (currentPoly.length === 0) {
      currentPoly.push([x, flippedY]);
      return;
    }
    const last = currentPoly[currentPoly.length - 1];
    if (Math.abs(last[0] - x) > 1e-3 || Math.abs(last[1] - flippedY) > 1e-3) {
      currentPoly.push([x, flippedY]);
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
        lastX = startX = cmd.x;
        lastY = startY = cmd.y;
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
        // Close: add starting point (but with flipped Y, so use raw startX, startY and let addPoint flip)
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

  const tryBuildShape = (letterSpacingUnits: number) => {
    const path = buildTextPath(font, safeText, size, letterSpacingUnits);
    const rawPolys = pathCommandsToPolygons(path, flattenTolUnits);
    const originalSvg = polygonsToPathData(rawPolys, 2);
    const scaledPolys = rawPolys
      .filter((poly) => poly.length >= 3)
      .map((poly) => poly.map((p) => ({ X: Math.round(p[0] * scaleUp), Y: Math.round(p[1] * scaleUp) })));
    
    // Create shape - be conservative, don't simplify yet as it can return empty
    const shape = new Shape(scaledPolys, true, false, false, true);
    return { originalSvg, shape, rawPolys };
  };

  if (!font || safeText.length === 0) {
    return {
      originalPath: '',
      processedPath: '',
      polygons: [],
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
  const { shape, rawPolys } = buildResult;

  // If no polygons, return early
  if (rawPolys.length === 0 || shape.paths.length === 0) {
    return {
      originalPath: originalSvg,
      processedPath: '',
      polygons: [],
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
  
  // Try to clean up, but fall back if result is empty
  merged = safeCleanDedupe(shape, shape);
  
  const componentsBefore = getTextComponents(merged).length;

  // 3) Auto tighten letter spacing if requested
  if (config.autoTighten && componentsBefore > 1 && maxTightenUnits > 0) {
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      const tighten = (-maxTightenUnits * i) / steps;
      const candidateLetterSpacingUnits = baseLetterSpacingUnits + tighten;
      const candidate = tryBuildShape(candidateLetterSpacingUnits);
      let candidateMerged = candidate.shape.clean(1).removeDuplicates();
      if (candidateMerged.paths.length === 0) candidateMerged = candidate.shape;
      if (candidateMerged.separateShapes().length <= 1) {
        appliedLetterSpacingUnits = candidateLetterSpacingUnits;
        originalSvg = candidate.originalSvg;
        merged = candidateMerged;
        break;
      }
    }
  }

  // 4) Bridge repair to force single connectivity (Soft pass with maxGap)
  const maxGap = Math.max(0, config.bridgeMaxGapMm) * unitsPerMm * scaleUp;
  const bridgeWidth = Math.max(0.1, config.minBridgeMm) * unitsPerMm * scaleUp;
  let usedBridgeCount = 0;

  for (let loop = 0; loop < 4; loop++) {
    const parts = getTextComponents(merged);
    if (parts.length <= 1) break;

    // Left-to-right chaining is stable for text
    const partsWithBounds = parts.map((s) => ({ shape: s, bounds: s.shapeBounds() }));
    partsWithBounds.sort((a, b) => a.bounds.left - b.bounds.left);

    let anyBridge = false;
    for (let i = 0; i < partsWithBounds.length - 1; i++) {
      const a = partsWithBounds[i].shape;
      const b = partsWithBounds[i + 1].shape;
      const pair = findClosestPointPair(a, b);
      if (!pair) continue;
      if (pair.dist2 > maxGap * maxGap) continue;

      const bridgePoly = buildCapsuleBridge(pair.a, pair.b, bridgeWidth);
      if (bridgePoly.length < 3) continue;
      const bridgeShape = new Shape([bridgePoly], true, false, false, true);
      const unionResult = merged.union(bridgeShape);
      if (unionResult.paths.length > 0) {
        merged = safeCleanDedupe(unionResult, merged);
        usedBridgeCount++;
        anyBridge = true;
      }
    }

    if (!anyBridge) break;
  }

  // 4.5) Hard guarantee: if still disconnected, force-bridge adjacent components iteratively.
  const forceBridge = config.forceBridgeIfStillDisconnected ?? true;
  if (forceBridge) {
    // Try repeatedly to merge the closest components until only 1 remains
    // Limit iterations to prevent infinite loops in pathological cases
    for (let attempt = 0; attempt < 30; attempt++) {
      const parts = getTextComponents(merged);
      if (parts.length <= 1) break;

      // Global closest-pair across all components (more robust than “first two by X”).
      let best:
        | { i: number; j: number; a: IntPoint; b: IntPoint; dist2: number }
        | null = null;

      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const pair = findClosestPointPair(parts[i], parts[j]);
          if (!pair) continue;
          if (!best || pair.dist2 < best.dist2) {
            best = { i, j, a: pair.a, b: pair.b, dist2: pair.dist2 };
          }
        }
      }

      if (!best) break;

      const bridgePoly = buildCapsuleBridge(best.a, best.b, bridgeWidth);
      if (bridgePoly.length < 3) break;

      const bridgeShape = new Shape([bridgePoly], true, false, false, true);
      const unionResult = merged.union(bridgeShape);
      if (unionResult.paths.length > 0) {
        merged = safeCleanDedupe(unionResult, merged);
        usedBridgeCount++;
      } else {
        break;
      }
    }
  }

  // 4.8) Last resort: morphological closing to merge “almost touching” parts.
  // This helps when Clipper considers a bridge as point-touch and still keeps components separate.
  if (forceBridge && merged.paths.length > 0 && getTextComponents(merged).length > 1) {
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
  const finalPaths = offsetShape.paths as IntPoint[][];
  let finalPolygons: number[][][];
  let processedPath: string;
  
  if (finalPaths.length === 0) {
    const repairedPaths = (merged.paths as IntPoint[][]) ?? [];
    if (repairedPaths.length > 0) {
      const result = toSvgPathData(repairedPaths, scaleUp);
      processedPath = result.d;
      finalPolygons = result.polygons;
    } else {
      // Last resort: use raw polygons
      finalPolygons = rawPolys;
      processedPath = polygonsToPathData(rawPolys, 2);
    }
  } else {
    const result = toSvgPathData(finalPaths, scaleUp);
    processedPath = result.d;
    finalPolygons = result.polygons;
  }

  return {
    originalPath: originalSvg,
    processedPath,
    polygons: finalPolygons,
    diagnostics: {
      componentsBeforeRepair: componentsBefore,
      componentsAfterRepair: getTextComponents(merged).length,
      appliedLetterSpacingMm: appliedLetterSpacingUnits / unitsPerMm,
      usedBridgeCount,
    },
  };
};
