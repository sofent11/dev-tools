import React from 'react';
import { Stage, Layer, Path, Text, Group, Transformer } from 'react-konva';
import { GeometryResult } from './utils/geometry';

interface CanvasStageProps {
  width: number;
  height: number;
  text: string;
  fontSize: number;
  position: { x: number; y: number };
  rotation: number;
  scale: number;
  geometry: GeometryResult | null;
  previewMode: 'visual' | 'manufacturing';
  onTransformChange: (newAttrs: { x: number; y: number; rotation: number; scale: number }) => void;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  width,
  height,
  text,
  fontSize,
  position,
  rotation,
  scale,
  geometry,
  previewMode,
  onTransformChange
}) => {
  const shapeRef = React.useRef<any>(null);
  const trRef = React.useRef<any>(null);

  React.useEffect(() => {
    if (trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [previewMode, geometry]); // Update transformer when content changes

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100 shadow-inner">
      <Stage width={width} height={height}>
        <Layer>
          {/* Background Grid or Guide (Optional) */}
          <Group>
             {/* Simple grid lines could go here */}
          </Group>

          {/* Main Design Group */}
          <Group
            ref={shapeRef}
            x={position.x}
            y={position.y}
            rotation={rotation}
            scaleX={scale}
            scaleY={scale}
            draggable
            onDragEnd={(e) => {
              onTransformChange({
                x: e.target.x(),
                y: e.target.y(),
                rotation: e.target.rotation(),
                scale: e.target.scaleX(),
              });
            }}
            onTransformEnd={(e) => {
              const node = shapeRef.current;
              onTransformChange({
                x: node.x(),
                y: node.y(),
                rotation: node.rotation(),
                scale: node.scaleX(),
              });
            }}
          >
            {previewMode === 'visual' ? (
              // Visual Mode: Always render Konva Text for reliability.
              // (Some SVG path strings from font tools can be parsed inconsistently by Konva.)
              <>
                <Text
                  text={text}
                  fontSize={fontSize}
                  fontFamily="Cinzel, serif"
                  fill="#334155"
                />
                {geometry?.originalPath && (
                  <Path
                    data={geometry.originalPath}
                    fill="transparent"
                    stroke="#0ea5e9"
                    strokeWidth={1}
                    opacity={0.35}
                    fillRule="evenodd"
                    listening={false}
                  />
                )}
              </>
            ) : (
              // Manufacturing Mode: The processed path
              geometry?.processedPath && (
                <Path
                  data={geometry.processedPath}
                  fill="#e2e8f0"
                  stroke="#ef4444"
                  strokeWidth={2}
                  opacity={0.9}
                  fillRule="evenodd"
                />
              )
            )}
            
            {/* Origin marker for debugging */}
            <Path data="M -5 0 L 5 0 M 0 -5 L 0 5" stroke="blue" strokeWidth={1} opacity={0.5} />
          </Group>

          {/* Transformer */}
          <Transformer
            ref={trRef}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            boundBoxFunc={(oldBox, newBox) => {
              // Limit resize if needed
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
};
