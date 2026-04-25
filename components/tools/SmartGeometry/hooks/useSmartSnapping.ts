import { useMemo } from "react";
import { useGeometryStore } from "../store/useGeometryStore";
import { MathUtils } from "../lib/MathUtils";
import { Point } from "../types";

export const SNAP_RADIUS = 20;

export function useSmartSnapping() {
  const { question, draftLine } = useGeometryStore();

  const snapCandidates = useMemo(() => {
    if (!question) return [];
    
    const candidates: Array<{ point: Point; type: 'vertex' | 'midpoint' | 'perpendicular' | 'intersection', id?: string }> = [];
    
    const { points, lines } = question.entities;

    // 1. Vertices
    for (const id in points) {
      candidates.push({ point: points[id], type: 'vertex', id });
    }

    // 2. Midpoints
    for (const lineId in lines) {
      const line = lines[lineId];
      const p1 = points[line.from];
      const p2 = points[line.to];
      if (p1 && p2) {
        candidates.push({
          point: MathUtils.midpoint(p1, p2),
          type: 'midpoint',
        });
      }
    }

    // 3. Perpendicular feet (if drawing a line)
    if (draftLine?.from) {
      for (const lineId in lines) {
        const line = lines[lineId];
        const p1 = points[line.from];
        const p2 = points[line.to];
        if (p1 && p2) {
          const foot = MathUtils.projectPointToLine(draftLine.from, p1, p2);
          if (foot && MathUtils.isPointOnSegment(foot, p1, p2)) {
            candidates.push({ point: foot, type: 'perpendicular' });
          }
        }
      }
    }

    return candidates;
  }, [question, draftLine]);

  const snapToPoint = (currentPos: Point) => {
    const candidatesByType: Record<string, typeof snapCandidates> = { vertex: [], midpoint: [], perpendicular: [], intersection: [] };
    for (const candidate of snapCandidates) {
       candidatesByType[candidate.type].push(candidate);
    }

    for (const type of ['vertex', 'midpoint', 'perpendicular', 'intersection']) {
       let closestInType = null;
       let minDistInType = SNAP_RADIUS;
       for (const candidate of candidatesByType[type]) {
          const dist = MathUtils.distance(currentPos, candidate.point);
          if (dist < minDistInType) {
             minDistInType = dist;
             closestInType = candidate;
          }
       }
       if (closestInType) return closestInType;
    }

    return null;
  };

  return { snapToPoint };
}
