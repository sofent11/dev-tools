import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CanvasStage } from './CanvasStage';
import { ControlPanel } from './ControlPanel';
import { generateGeometry, loadFont, GeometryResult } from './utils/geometry';
import opentype from 'opentype.js';

// NOTE: gstatic direct TTF URLs are versioned and may 404.
// Use a stable, CORS-enabled raw GitHub URL for opentype.js parsing.
const AVAILABLE_FONTS = [
  { name: 'Cinzel', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf' },
  { name: 'Playfair Display', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf' },
  { name: 'Montserrat', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/static/Montserrat-Regular.ttf' },
  { name: 'Poppins', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf' },
  { name: 'Great Vibes (自动加固)', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf' },
  { name: 'Pacifico', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf' },
  { name: 'Raleway', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/Raleway%5Bwght%5D.ttf' },
  { name: 'Libre Baskerville', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/LibreBaskerville-Regular.ttf' },
  { name: 'Abril Fatface', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/abrilfatface/AbrilFatface-Regular.ttf' },
  { name: 'Cinzel Decorative', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzeldecorative/CinzelDecorative-Regular.ttf' },
];

export const JewelryCustomizer: React.FC = () => {
  // State
  const [selectedFont, setSelectedFont] = useState(AVAILABLE_FONTS[0]);
  const [text, setText] = useState('ALVIN');
  const [fontSize, setFontSize] = useState(100);
  const [offsetMm, setOffsetMm] = useState(0.2);
  const [letterSpacingMm, setLetterSpacingMm] = useState(0);
  const [minBridgeMm, setMinBridgeMm] = useState(1.0);
  const [bridgeMaxGapMm, setBridgeMaxGapMm] = useState(12);
  const [flattenToleranceMm, setFlattenToleranceMm] = useState(0.05);
  const [autoTighten, setAutoTighten] = useState(true);
  const [autoTightenMaxMm, setAutoTightenMaxMm] = useState(1.5);
  // Default to ~96DPI px/mm for a more intuitive “mm” mapping in preview space.
  const [unitsPerMm, setUnitsPerMm] = useState(3.78);
  const [previewMode, setPreviewMode] = useState<'visual' | 'manufacturing'>('visual');
  const [geometry, setGeometry] = useState<GeometryResult | null>(null);
  
  const [position, setPosition] = useState({ x: 300, y: 300 });
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  
  const [font, setFont] = useState<opentype.Font | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);

  // Load Font
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!selectedFont) return;

      setLoading(true);
      setFontError(null);

      try {
        const loadedFont = await loadFont(selectedFont.url);
        if (cancelled) return;
        setFont(loadedFont);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        console.warn('Failed to load font URL:', selectedFont.url, err);
        setFont(null);
        setFontError('字体文件加载失败（TTF/OTF URL 可能不可用或被拦截）。');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedFont]);

  // Geometry Processing Loop
  useEffect(() => {
    if (!font || !text) return;

    setProcessing(true);
    const timer = setTimeout(() => {
      try {
        const result = generateGeometry(text, font, fontSize, {
          unitsPerMm,
          kerfMm: 0.3,
          offsetMm,
          minBridgeMm,
          bridgeMaxGapMm,
          flattenToleranceMm,
          letterSpacingMm,
          autoTighten,
          autoTightenMaxMm,
        });
        setGeometry(result);
      } catch (e) {
        console.error('Geometry processing failed:', e);
      } finally {
        setProcessing(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [text, fontSize, offsetMm, letterSpacingMm, minBridgeMm, bridgeMaxGapMm, flattenToleranceMm, autoTighten, autoTightenMaxMm, unitsPerMm, font]);

  const handleExport = () => {
    if (!geometry) return;

    const polys = geometry.polygons;
    const bounds = polys.reduce(
      (acc, poly) => {
        for (const [x, y] of poly) {
          acc.minX = Math.min(acc.minX, x);
          acc.minY = Math.min(acc.minY, y);
          acc.maxX = Math.max(acc.maxX, x);
          acc.maxY = Math.max(acc.maxY, y);
        }
        return acc;
      },
      { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
    );
    const width = Number.isFinite(bounds.maxX - bounds.minX) ? bounds.maxX - bounds.minX : 100;
    const height = Number.isFinite(bounds.maxY - bounds.minY) ? bounds.maxY - bounds.minY : 100;
    const pad = 10;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width + pad * 2}" height="${height + pad * 2}" viewBox="${bounds.minX - pad} ${bounds.minY - pad} ${width + pad * 2} ${height + pad * 2}">\n` +
      `  <path d="${geometry.processedPath}" fill="none" stroke="#000" stroke-width="1" fill-rule="evenodd"/>\n` +
      `</svg>\n`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jewelry_design_${Date.now()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top Bar (Optional) */}
      
      <div className="flex flex-col lg:flex-row h-full gap-4">
        {/* Left: Canvas */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 p-4 min-h-[400px] flex flex-col">
          <div className="flex-1 relative">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                Loading resources...
              </div>
            ) : fontError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500 px-6 text-center">
                <div className="font-medium text-slate-700">字体加载失败</div>
                <div className="text-xs">{fontError}</div>
                <div className="text-xs text-slate-400">生产预览需要可解析的 TTF/OTF 字体文件。</div>
              </div>
            ) : (
              <CanvasStage
                width={800} // Ideally dynamic based on container
                height={600}
                text={text}
                fontSize={fontSize}
                position={position}
                rotation={rotation}
                scale={scale}
                geometry={geometry}
                previewMode={previewMode}
                onTransformChange={(attrs) => {
                  setPosition({ x: attrs.x, y: attrs.y });
                  setRotation(attrs.rotation);
                  setScale(attrs.scale);
                }}
              />
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400 text-center">
            {previewMode === 'visual' ? '可拖拽文字 • 滚轮缩放' : '红色轮廓为最终切割路径'}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="w-full lg:w-80 flex-none">
          <ControlPanel
            text={text}
            setText={setText}
            fontSize={fontSize}
            setFontSize={setFontSize}
            offsetMm={offsetMm}
            setOffsetMm={setOffsetMm}
            letterSpacingMm={letterSpacingMm}
            setLetterSpacingMm={setLetterSpacingMm}
            minBridgeMm={minBridgeMm}
            setMinBridgeMm={setMinBridgeMm}
            bridgeMaxGapMm={bridgeMaxGapMm}
            setBridgeMaxGapMm={setBridgeMaxGapMm}
            flattenToleranceMm={flattenToleranceMm}
            setFlattenToleranceMm={setFlattenToleranceMm}
            autoTighten={autoTighten}
            setAutoTighten={setAutoTighten}
            autoTightenMaxMm={autoTightenMaxMm}
            setAutoTightenMaxMm={setAutoTightenMaxMm}
            unitsPerMm={unitsPerMm}
            setUnitsPerMm={setUnitsPerMm}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
            onExport={handleExport}
            availableFonts={AVAILABLE_FONTS}
            selectedFont={selectedFont}
            setSelectedFont={setSelectedFont}
            isProcessing={processing}
            diagnostics={geometry?.diagnostics ?? null}
          />
        </div>
      </div>
    </div>
  );
};

// Default export for lazy loading compatibility if needed
export default JewelryCustomizer;
