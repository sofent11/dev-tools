export interface Point {
  x: number;
  y: number;
  label?: string;
  isSolution?: boolean;
}

export interface Line {
  from: string; // Point ID
  to: string; // Point ID
  style: "solid" | "dashed";
  color?: string;
  isAuxiliary?: boolean;
  isSolution?: boolean;
}

export interface Polygon {
  vertices: string[]; // Array of Point IDs
  fill: string;
  stroke?: string;
  isSolution?: boolean;
}

export interface Constraint {
  type: "perpendicular" | "parallel" | "length" | "angle";
  targets: string[];
  value?: number;
}

export interface SlideAnnotation {
  text: string;
  x: number;
  y: number;
}

export interface TeachingSlide {
  caption: string;
  highlightPolygons?: string[];
  highlightLines?: string[];
  highlightPoints?: string[];
  annotations?: SlideAnnotation[];
  showAuxLines?: string[];
  showSolutionPolygons?: string[];
  showSolutionLines?: string[];
  showSolutionPoints?: string[];
}

export interface GeometryQuestion {
  id: string;
  meta: {
    title: string;
    originalText?: string;
    difficulty: "easy" | "medium" | "hard";
  };
  entities: {
    points: Record<string, Point>;
    lines: Record<string, Line>;
    polygons: Record<string, Polygon>;
  };
  constraints: Constraint[];
  slides: TeachingSlide[];
  initialAnnotations?: SlideAnnotation[];
}
