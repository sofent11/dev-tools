import { Point } from "../types";

export const MathUtils = {
  distance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
  },

  midpoint(p1: Point, p2: Point): Point {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  },

  // Project point p onto line passing through a and b
  projectPointToLine(p: Point, a: Point, b: Point): Point | null {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return null; // a and b are the same point

    // t is the projection parameter
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    // Limit to line segment if we want only perpendiculars on the segment
    // But usually perpendicular foot can be outside the segment.
    // For snapping, maybe we want it anywhere on the line, but let's stick to the segment or infinite line.
    // Let's allow infinite line.
    
    return {
      x: a.x + t * dx,
      y: a.y + t * dy,
    };
  },

  // Check if projection point is approximately on the line segment
  isPointOnSegment(p: Point, a: Point, b: Point, tolerance = 0.5): boolean {
     const crossProduct = (p.y - a.y) * (b.x - a.x) - (p.x - a.x) * (b.y - a.y);
     if (Math.abs(crossProduct) > tolerance) return false;

     const dotProduct = (p.x - a.x) * (b.x - a.x) + (p.y - a.y)*(b.y - a.y);
     if (dotProduct < 0) return false;

     const squaredLengthBA = (b.x - a.x)*(b.x - a.x) + (b.y - a.y)*(b.y - a.y);
     if (dotProduct > squaredLengthBA) return false;

     return true;
  },

  // Line intersection: line 1 (p1, p2) and line 2 (p3, p4)
  lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point | null {
    const denominator = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (denominator === 0) return null; // Parallel

    const px = ((p1.x * p2.y - p1.y * p2.x) * (p3.x - p4.x) - (p1.x - p2.x) * (p3.x * p4.y - p3.y * p4.x)) / denominator;
    const py = ((p1.x * p2.y - p1.y * p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x * p4.y - p3.y * p4.x)) / denominator;
    
    return { x: px, y: py };
  }
};
