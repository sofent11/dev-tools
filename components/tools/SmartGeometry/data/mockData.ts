import { GeometryQuestion } from "../types";

export const MOCK_QUESTION: GeometryQuestion = {
  id: "q-001",
  meta: {
    title: "练习 4.2：三角形的高",
    originalText: "已知：在 $\\triangle ABC$ 中，底边长为 $BC$。求作三角形 $ABC$ 底边 $BC$ 上的高。",
    difficulty: "medium",
  },
  initialAnnotations: [
    { text: "底边", x: 400, y: 465 }
  ],
  entities: {
    points: {
      "p-A": { x: 400, y: 150, label: "A" },
      "p-B": { x: 200, y: 450, label: "B" },
      "p-C": { x: 600, y: 450, label: "C" },
    },
    lines: {
      "l-AB": { from: "p-A", to: "p-B", style: "solid" },
      "l-BC": { from: "p-B", to: "p-C", style: "solid" },
      "l-CA": { from: "p-C", to: "p-A", style: "solid" },
    },
    polygons: {
      "poly-ABC": { vertices: ["p-A", "p-B", "p-C"], fill: "rgba(37, 99, 235, 0.05)", stroke: "transparent" },
    },
  },
  constraints: [
    { type: "length", targets: ["l-AB"], value: 10 }
  ],
  slides: [
    { 
      caption: "观察三角形 ABC。",
      highlightPolygons: ["poly-ABC"]
    },
    { 
      caption: "现在我们来看顶点 A。",
      highlightPoints: ["p-A"]
    },
    { 
      caption: "画出从点 A 到边 BC 的高。",
      highlightLines: ["l-BC"],
      annotations: [{ text: "由于底边 BC 在这里", x: 400, y: 480 }]
    }
  ]
};
