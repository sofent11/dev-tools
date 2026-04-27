import React, { useRef, useState } from 'react';
import { useGeometryStore } from '../store/useGeometryStore';
import { useSmartSnapping } from '../hooks/useSmartSnapping';
import { Point } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export function GeometryCanvas() {
  const { mode, tool, question, viewport, setViewport, draftLine, setDraftLine, snappedPoint, setSnappedPoint, addPoint, updatePoint, addLine } = useGeometryStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingLayerRef = useRef<SVGGElement>(null);
  const { snapToPoint } = useSmartSnapping();

  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPos, setLastPanPos] = useState<Point>({ x: 0, y: 0 });
  const [draggingPointId, setDraggingPointId] = useState<string | null>(null);

  const getLogicalPosition = (e: React.PointerEvent): Point => {
    if (!svgRef.current || !drawingLayerRef.current) return { x: 0, y: 0 };

    const screenCTM = drawingLayerRef.current.getScreenCTM();
    if (!screenCTM) return { x: 0, y: 0 };

    const pointer = svgRef.current.createSVGPoint();
    pointer.x = e.clientX;
    pointer.y = e.clientY;

    const logicalPoint = pointer.matrixTransform(screenCTM.inverse());
    return {
      x: logicalPoint.x,
      y: logicalPoint.y,
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (mode !== 'interactive') return;
    
    // allow panning with middle click or spacebar+click, but here let's just say panning mode
    if (tool === 'pan') {
      setIsPanning(true);
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    if (tool === 'move') {
      const logicalPos = getLogicalPosition(e);
      let closestPtId: string | null = null;
      let minDist = 20; // Hit radius
      
      if (question) {
        Object.entries(question.entities.points).forEach(([id, pt]) => {
          const dist = Math.sqrt(Math.pow(pt.x - logicalPos.x, 2) + Math.pow(pt.y - logicalPos.y, 2));
          if (dist < minDist) {
            minDist = dist;
            closestPtId = id;
          }
        });
      }

      if (closestPtId) {
        setDraggingPointId(closestPtId);
      }
      return;
    }

    if (tool === 'line') {
      const logicalPos = getLogicalPosition(e);
      const snapped = snapToPoint(logicalPos);
      
      const startPoint = snapped ? snapped.point : logicalPos;
      
      setDraftLine({ from: startPoint, to: logicalPos });
      // We might need to store the ID if we snapped to a vertex, to connect them logically
      // For now, if no ID, we'll generate one later.
      if (snapped && snapped.type === 'vertex') {
         // attach vertex id?
         // we can just match by exact coordinates during pointer up.
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (mode !== 'interactive') return;

    if (isPanning && tool === 'pan') {
      const dx = e.clientX - lastPanPos.x;
      const dy = e.clientY - lastPanPos.y;
      setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      setLastPanPos({ x: e.clientX, y: e.clientY });
      return;
    }

    const logicalPos = getLogicalPosition(e);

    if (tool === 'move' && draggingPointId) {
      updatePoint(draggingPointId, { x: logicalPos.x, y: logicalPos.y });
      return;
    }
    
    if (tool === 'line') {
      const snapped = snapToPoint(logicalPos);
      setSnappedPoint(snapped);
      
      if (draftLine) {
        setDraftLine({ ...draftLine, to: snapped ? snapped.point : logicalPos });
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (mode !== 'interactive') return;

    if (isPanning) {
      setIsPanning(false);
    }

    if (tool === 'move' && draggingPointId) {
      setDraggingPointId(null);
    }

    if (tool === 'line' && draftLine && draftLine.to) {
      // Finalize line
      const logicalPos = getLogicalPosition(e);
      const snapped = snapToPoint(logicalPos);
      
      const finalEnd = snapped ? snapped.point : logicalPos;
      const finalStart = draftLine.from;

      if (finalStart.x !== finalEnd.x || finalStart.y !== finalEnd.y) {
         // Generate IDs
         // Check if start/end matches existing vertices
         let startId = null;
         let endId = null;

         const existingLabels: string[] = [];

         if (question) {
            for (const [id, pt] of Object.entries(question.entities.points)) {
               if (pt.x === finalStart.x && pt.y === finalStart.y) startId = id;
               if (pt.x === finalEnd.x && pt.y === finalEnd.y) endId = id;
               if (pt.label && pt.label.length === 1) existingLabels.push(pt.label);
            }
         }

         const getNextLabel = () => {
            for(let i=65; i<=90; i++) { // A-Z
               const char = String.fromCharCode(i);
               if (!existingLabels.includes(char)) {
                 existingLabels.push(char); // reserve it
                 return char;
               }
            }
            return undefined;
         };

         const sId = startId || `p-aux-${Date.now()}-1`;
         const eId = endId || `p-aux-${Date.now()}-2`;
         const newPointIds = [];

         if (!startId) {
            addPoint(sId, { ...finalStart, label: getNextLabel() });
            newPointIds.push(sId);
         }
         if (!endId) {
            addPoint(eId, { ...finalEnd, label: getNextLabel() });
            newPointIds.push(eId);
         }

         addLine(`l-aux-${Date.now()}`, {
           from: sId,
           to: eId,
           style: 'solid',
           color: '#0891b2',
           isAuxiliary: true
         }, newPointIds);
      }

      setDraftLine(null);
      setSnappedPoint(null);
    }
  };

  if (!question) return null;

  const { points, lines, polygons } = question.entities;

  // Snapping UI mapping
  const snapTypeLabel = {
    vertex: "(顶点)",
    midpoint: "(中点)",
    perpendicular: "(垂足)",
    intersection: "(交点)"
  };

  return (
    <>
      <svg
        ref={svgRef}
        className={`absolute inset-0 w-full h-full bg-transparent ${tool === 'pan' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : tool === 'move' ? (draggingPointId ? 'cursor-grabbing' : 'cursor-pointer') : 'cursor-crosshair'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8">
            <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="currentColor" strokeWidth="1" className="text-blue-500 opacity-50" />
          </pattern>
        </defs>
        <g ref={drawingLayerRef} transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}>
          {/* Polygons */}
          {Object.entries(polygons).map(([id, poly]) => {
            if (poly.isSolution) return null;
            const pts = poly.vertices.map(v => `${points[v].x},${points[v].y}`).join(' ');
            return <polygon key={id} points={pts} fill={poly.fill === 'url(#hatch)' ? "url(#hatch)" : (poly.fill || "rgba(37, 99, 235, 0.05)")} stroke={poly.stroke || '#1e293b'} strokeWidth="3" strokeLinejoin="round" />;
          })}

          {/* Lines */}
          {Object.entries(lines).map(([id, line]) => {
            if (line.isSolution) return null;
            const p1 = points[line.from];
            const p2 = points[line.to];
            if (!p1 || !p2) return null;
            return (
              <line
                key={id}
                x1={p1.x}
                y1={p1.y}
                x2={p2.x}
                y2={p2.y}
                stroke={line.color || (line.isAuxiliary ? "#0891b2" : "#1e293b")}
                strokeWidth={line.isAuxiliary ? 2 : 3}
                strokeDasharray={line.style === 'dashed' ? '6,4' : 'none'}
              />
            );
          })}

          {/* Vertices */}
          {Object.entries(points).map(([id, pt]) => {
            if (pt.isSolution) return null;
            return (
              <g key={id} className={`font-sans font-bold text-sm ${tool === 'move' ? 'cursor-pointer' : ''}`}>
                 <circle cx={pt.x} cy={pt.y} r={draggingPointId === id ? 8 : 5} fill={draggingPointId === id ? '#0891b2' : '#1e293b'} />
                 {pt.label && (
                    <text x={pt.x - 8} y={pt.y - 15} fill={draggingPointId === id ? '#0891b2' : '#1e293b'} className="select-none font-bold text-sm pointer-events-none">
                       {pt.label}
                    </text>
                 )}
              </g>
            );
          })}

          {/* Draft Line */}
          {draftLine && draftLine.to && (
            <line
              x1={draftLine.from.x}
              y1={draftLine.from.y}
              x2={draftLine.to.x}
              y2={draftLine.to.y}
              stroke="#0891b2"
              strokeWidth="2"
              strokeDasharray="6,4"
            />
          )}

          {/* Snapping Feedback */}
          {snappedPoint && (
             <g transform={`translate(${snappedPoint.point.x}, ${snappedPoint.point.y})`}>
                <circle r="20" fill="rgba(16, 185, 129, 0.1)" stroke="#10b981" strokeWidth="1" strokeDasharray="2,2" />
                <rect x="-4" y="-4" width="8" height="8" fill="#10b981" />
                {snappedPoint.type === 'perpendicular' && (
                   <polyline points="0,-15 15,-15 15,0" fill="none" stroke="#10b981" strokeWidth="1.5" />
                )}
             </g>
          )}
        </g>
      </svg>

      {/* Interactive Floating Tooltip */}
      {snappedPoint && tool === 'line' && (
        <div className="absolute left-1/2 bottom-12 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-medium shadow-2xl flex items-center gap-3 pointer-events-none z-30">
          <span className="opacity-70">工具: 画线</span>
          <div className="w-px h-3 bg-white/20"></div>
          <span className="text-emerald-400 font-bold">已吸附 {snapTypeLabel[snappedPoint.type!]}</span>
        </div>
      )}

      {/* Initial Annotations Overlay */}
      {question.initialAnnotations && question.initialAnnotations.map((ann, i) => {
          if (typeof ann.x !== 'number' || typeof ann.y !== 'number') return null;
          const x = ann.x * viewport.zoom + viewport.x;
          const y = ann.y * viewport.zoom + viewport.y;
          return (
            <div 
              key={`init-ann-${i}`}
              className="absolute bg-white/80 text-slate-800 px-3 py-1.5 rounded-lg shadow-sm text-sm font-bold border border-slate-200 z-10 pointer-events-none transition-transform duration-75 max-w-xs"
              style={{ left: `${x}px`, top: `${y}px`, transform: `translate(-50%, -50%) scale(${viewport.zoom})`, transformOrigin: "center center" }}
            >
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node: _node, ...props}) => <span {...props} /> }}>
                {ann.text}
              </ReactMarkdown>
            </div>
          );
      })}
    </>
  );
}
