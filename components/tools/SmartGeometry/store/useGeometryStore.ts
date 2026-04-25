import { create } from 'zustand';
import { GeometryQuestion, Point, Line } from '../types';

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export type Mode = 'interactive' | 'teaching';
export type Tool = 'pan' | 'line' | 'move';

interface GeometryState {
  mode: Mode;
  tool: Tool;
  question: GeometryQuestion | null;
  viewport: Viewport;
  
  // Interactive Drawing State
  draftLine: { from: Point; to: Point | null } | null;
  snappedPoint: { point: Point, type: 'vertex' | 'midpoint' | 'perpendicular' | 'intersection' | null, id?: string } | null;
  
  auxHistory: Array<{ lineId: string, pointIds: string[] }>;

  setMode: (mode: Mode) => void;
  setTool: (tool: Tool) => void;
  setQuestion: (question: GeometryQuestion) => void;
  setViewport: (viewport: Viewport | ((prev: Viewport) => Viewport)) => void;
  
  setDraftLine: (draft: GeometryState['draftLine']) => void;
  setSnappedPoint: (snapped: GeometryState['snappedPoint']) => void;

  addPoint: (id: string, point: Point) => void;
  updatePoint: (id: string, updates: Partial<Point>) => void;
  addLine: (id: string, line: Line, associatedPointIds?: string[]) => void;
  undoLastAux: () => void;
  clearAuxiliaryLines: () => void;
}

export const useGeometryStore = create<GeometryState>((set) => ({
  mode: 'interactive',
  tool: 'pan',
  question: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  
  draftLine: null,
  snappedPoint: null,
  auxHistory: [],

  setMode: (mode) => set({ mode }),
  setTool: (tool) => set({ tool }),
  setQuestion: (question) => set({ question, auxHistory: [] }),
  setViewport: (viewport) => set((state) => ({ 
    viewport: typeof viewport === 'function' ? viewport(state.viewport) : viewport 
  })),

  setDraftLine: (draft) => set({ draftLine: draft }),
  setSnappedPoint: (snapped) => set({ snappedPoint: snapped }),

  addPoint: (id, point) => set((state) => {
    if (!state.question) return state;
    return {
      question: {
        ...state.question,
        entities: {
          ...state.question.entities,
          points: {
            ...state.question.entities.points,
            [id]: point
          }
        }
      }
    };
  }),

  updatePoint: (id, updates) => set((state) => {
    if (!state.question || !state.question.entities.points[id]) return state;
    return {
      question: {
        ...state.question,
        entities: {
          ...state.question.entities,
          points: {
            ...state.question.entities.points,
            [id]: { ...state.question.entities.points[id], ...updates }
          }
        }
      }
    };
  }),

  addLine: (id, line, associatedPointIds = []) => set((state) => {
    if (!state.question) return state;
    return {
      question: {
        ...state.question,
        entities: {
          ...state.question.entities,
          lines: {
            ...state.question.entities.lines,
            [id]: line
          }
        }
      },
      auxHistory: line.isAuxiliary 
        ? [...state.auxHistory, { lineId: id, pointIds: associatedPointIds }]
        : state.auxHistory
    };
  }),

  undoLastAux: () => set((state) => {
    if (!state.question || state.auxHistory.length === 0) return state;
    const last = state.auxHistory[state.auxHistory.length - 1];
    
    const newLines = { ...state.question.entities.lines };
    const newPoints = { ...state.question.entities.points };
    
    delete newLines[last.lineId];
    last.pointIds.forEach(pid => delete newPoints[pid]);

    return {
      question: {
        ...state.question,
        entities: {
          ...state.question.entities,
          lines: newLines,
          points: newPoints
        }
      },
      auxHistory: state.auxHistory.slice(0, -1)
    };
  }),

  clearAuxiliaryLines: () => set((state) => {
    if (!state.question) return state;
    const lines = { ...state.question.entities.lines };
    for (const key in lines) {
      if (lines[key].isAuxiliary) {
        delete lines[key];
      }
    }
    return {
      question: {
        ...state.question,
        entities: {
          ...state.question.entities,
          lines
        }
      },
      auxHistory: []
    };
  })
}));
