import React, { useState } from 'react';
import { useGeometryStore } from '../store/useGeometryStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export function TeachingSlides() {
  const { question } = useGeometryStore();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  if (!question || !question.slides || question.slides.length === 0) return null;

  const { points, lines, polygons } = question.entities;
  const slide = question.slides[currentSlideIndex];

  const highlightedPolygons = Array.isArray(slide.highlightPolygons) ? slide.highlightPolygons : [];
  const highlightedLines = Array.isArray(slide.highlightLines) ? slide.highlightLines : [];
  const highlightedPoints = Array.isArray(slide.highlightPoints) ? slide.highlightPoints : [];
  const activeAnnotations = Array.isArray(slide.annotations) ? slide.annotations : [];
  // Compute accumulated visibility up to the current slide
  const computeVisible = (slideIndex: number, field: 'showSolutionPolygons' | 'showSolutionLines' | 'showSolutionPoints' | 'showAuxLines') => {
    const visible = new Set<string>();
    for (let i = 0; i <= slideIndex; i++) {
        const s = question.slides[i];
        if (Array.isArray(s[field])) {
           s[field].forEach(id => visible.add(id));
        }
    }
    return Array.from(visible);
  };

  const visibleSolutionPolygons = computeVisible(currentSlideIndex, 'showSolutionPolygons');
  const visibleSolutionLines = computeVisible(currentSlideIndex, 'showSolutionLines');
  const visibleSolutionPoints = computeVisible(currentSlideIndex, 'showSolutionPoints');
  const visibleAuxLines = computeVisible(currentSlideIndex, 'showAuxLines');

  const handlePrev = () => {
    setCurrentSlideIndex(s => Math.max(0, s - 1));
  };

  const handleNext = () => {
    setCurrentSlideIndex(s => Math.min(question.slides.length - 1, s + 1));
  };

  return (
    <div className="w-full h-full flex flex-col items-center bg-transparent justify-center p-8">
       <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          
          <div className="flex-1 relative bg-transparent overflow-hidden min-h-[400px]">
            <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" width="100%" height="100%">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#000" strokeWidth="1"/>
                </pattern>
                <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8">
                  <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="currentColor" strokeWidth="1" className="text-blue-500 opacity-50" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
            
            <svg className="w-full h-full pointer-events-none absolute inset-0 z-10" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid meet">
               <g transform="scale(1)">
                 
                 {/* Polygons */}
                 {Object.entries(polygons).map(([id, poly]) => {
                   if (poly.isSolution && !visibleSolutionPolygons.includes(id)) return null;
                   const pts = poly.vertices.map(v => `${points[v].x},${points[v].y}`).join(' ');
                   const isHighlighted = highlightedPolygons.includes(id);
                   const displayFill = isHighlighted ? 'rgba(234, 179, 8, 0.4)' : (poly.fill === 'url(#hatch)' ? "url(#hatch)" : (poly.fill || "rgba(37, 99, 235, 0.05)"));
                   const displayStroke = isHighlighted ? '#eab308' : (poly.stroke || '#1e293b');
                   const displayStrokeWidth = isHighlighted ? 4 : 3;
                   return <polygon key={id} points={pts} fill={displayFill} stroke={displayStroke} strokeWidth={displayStrokeWidth} strokeLinejoin="round" className="transition-all duration-300" />;
                 })}

                 {/* Lines */}
                 {Object.entries(lines).map(([id, line]) => {
                   if (line.isSolution && !visibleSolutionLines.includes(id)) return null;
                   // If it's an auxiliary line, only show if it's explicitly in showAuxLines
                   if (!line.isSolution && line.isAuxiliary && !visibleAuxLines.includes(id)) {
                      return null;
                   }
                   
                   const p1 = points[line.from];
                   const p2 = points[line.to];
                   if (!p1 || !p2) return null;
                   
                   const isHighlightedLine = highlightedLines.includes(id);
                   
                   return (
                     <line
                       key={id}
                       x1={p1.x}
                       y1={p1.y}
                       x2={p2.x}
                       y2={p2.y}
                       stroke={isHighlightedLine ? '#eab308' : (line.color || (line.isAuxiliary ? "#2563eb" : "#1e293b"))}
                       strokeWidth={isHighlightedLine ? 5 : (line.isAuxiliary ? 2 : 3)}
                       strokeDasharray={line.style === 'dashed' ? '6,4' : `none`}
                       className="transition-colors duration-300"
                     />
                   );
                 })}

                 {/* Vertices */}
                 {Object.entries(points).map(([id, pt]) => {
                   if (pt.isSolution && !visibleSolutionPoints.includes(id)) return null;
                   const isHighlighted = highlightedPoints.includes(id);
                   
                   return (
                     <g key={id} className="font-sans font-bold text-sm">
                       {isHighlighted && (
                          <circle cx={pt.x} cy={pt.y} r={18} fill="rgba(16, 185, 129, 0.1)" stroke="#10b981" strokeWidth="2" strokeDasharray="4,4" className="animate-pulse" />
                       )}
                       <circle cx={pt.x} cy={pt.y} r={5} fill="#1e293b" />
                       {pt.label && (
                          <text x={pt.x - 8} y={pt.y - 15} fill="#1e293b" className="font-sans font-bold text-sm">
                             {pt.label}
                          </text>
                       )}
                     </g>
                   );
                 })}

               </g>
            </svg>

            {/* Annotations Overlay */}
            {activeAnnotations.map((ann, i) => {
               if (typeof ann.x !== 'number' || typeof ann.y !== 'number') return null;
               // We need to scale these coordinates relative to the svg viewport (0 0 800 600)
               // For simplicity, we can just use percentage based on 800x600 if we assumed consistent aspect ratio, 
               // but absolute works well enough since the container is relatively sized.
               return (
                  <div 
                     key={`ann-${i}`}
                     className="absolute bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg shadow-md text-sm font-bold border border-amber-300 z-10 animate-fade-in pointer-events-none"
                     style={{ left: `${(ann.x / 800) * 100}%`, top: `${(ann.y / 600) * 100}%`, transform: 'translate(-50%, -50%)' }}
                  >
                     <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({node: _node, ...props}) => <span {...props} /> }}>
                       {ann.text}
                     </ReactMarkdown>
                  </div>
               );
            })}

          </div>
          
          {/* Controls Footer */}
          <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-6 flex flex-col gap-4 relative z-20">
             <div className="text-slate-800 text-center font-medium min-h-[3rem] px-4 markdown-body">
               <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                 {slide.caption}
               </ReactMarkdown>
             </div>
             
             <div className="flex items-center justify-between mt-2">
                <button 
                  onClick={handlePrev}
                  disabled={currentSlideIndex === 0}
                  className="p-2 sm:px-4 sm:py-2 flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm"
                >
                  <ChevronLeft size={18} />
                  <span className="hidden sm:inline">上一步</span>
                </button>
                
                <div className="text-sm font-mono text-slate-500 font-medium">
                  {currentSlideIndex + 1} / {question.slides.length}
                </div>
                
                <button 
                  onClick={handleNext}
                  disabled={currentSlideIndex === question.slides.length - 1}
                  className="p-2 sm:px-4 sm:py-2 flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-primary-600 border border-primary-700 text-white hover:bg-primary-700 shadow-sm"
                >
                  <span className="hidden sm:inline">下一步</span>
                  <ChevronRight size={18} />
                </button>
             </div>
          </div>
          
       </div>
    </div>
  );
}
