import React, { useRef, useState } from 'react';
import { GeometryResult } from './utils/geometry';

interface CanvasStageProps {
  width: number;
  height: number;
  position: { x: number; y: number };
  rotation: number;
  scale: number;
  geometry: GeometryResult | null;
  onTransformChange: (newAttrs: { x: number; y: number; rotation: number; scale: number }) => void;
}

const getSvgPoint = (svg: SVGSVGElement, event: React.PointerEvent): { x: number; y: number } => {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = svg.getScreenCTM();
  if (!matrix) return { x: 0, y: 0 };
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
};

export const CanvasStage: React.FC<CanvasStageProps> = ({
  width,
  height,
  position,
  rotation,
  scale,
  geometry,
  onTransformChange,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragStart, setDragStart] = useState<{ pointer: { x: number; y: number }; position: { x: number; y: number } } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<SVGGElement>) => {
    if (!svgRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({
      pointer: getSvgPoint(svgRef.current, event),
      position,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<SVGGElement>) => {
    if (!svgRef.current || !dragStart) return;
    const pointer = getSvgPoint(svgRef.current, event);
    onTransformChange({
      x: dragStart.position.x + pointer.x - dragStart.pointer.x,
      y: dragStart.position.y + pointer.y - dragStart.pointer.y,
      rotation,
      scale,
    });
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const nextScale = Math.min(6, Math.max(0.15, scale * (event.deltaY > 0 ? 0.92 : 1.08)));
    onTransformChange({
      x: position.x,
      y: position.y,
      rotation,
      scale: nextScale,
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-inner">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block max-h-[70vh] w-full touch-none select-none"
        onWheel={handleWheel}
      >
        <defs>
          <pattern id="jewelry-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#cbd5e1" strokeWidth="0.75" opacity="0.45" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#jewelry-grid)" />

        <g
          transform={`translate(${position.x} ${position.y}) rotate(${rotation}) scale(${scale})`}
          className="cursor-move"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDragStart(null)}
          onPointerCancel={() => setDragStart(null)}
        >
          {geometry?.framePath ? (
            <>
              <path
                d={geometry.framePath}
                fill="#cbd5e1"
                stroke="#64748b"
                strokeWidth={1.5}
                opacity={0.7}
                fillRule="evenodd"
              />
              <path
                d={geometry.textPath}
                fill="#e2e8f0"
                stroke="#ef4444"
                strokeWidth={1.8}
                opacity={0.95}
                fillRule="evenodd"
              />
            </>
          ) : (
            geometry?.processedPath && (
              <path
                d={geometry.processedPath}
                fill="#e2e8f0"
                stroke="#ef4444"
                strokeWidth={2}
                opacity={0.9}
                fillRule="evenodd"
              />
            )
          )}
          <path d="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="#2563eb" strokeWidth={1} opacity={0.55} pointerEvents="none" />
        </g>
      </svg>
    </div>
  );
};
