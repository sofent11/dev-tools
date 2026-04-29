import React, { useState, useEffect } from 'react';
import { CanvasStage } from './CanvasStage';
import { ControlPanel } from './ControlPanel';
import { generateGeometry, loadFont, GeometryResult } from './utils/geometry';
import opentype from 'opentype.js';

// NOTE: gstatic direct TTF URLs are versioned and may 404.
// Use a stable, CORS-enabled raw GitHub URL for opentype.js parsing.
// The Cute additions come from Google Fonts tag /Expressive/Cute.
const AVAILABLE_FONTS = [
  { name: 'Cinzel', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/Cinzel%5Bwght%5D.ttf' },
  { name: 'Playfair Display', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf' },
  { name: 'Montserrat', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf' },
  { name: 'Poppins', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf' },
  { name: 'Great Vibes (自动加固)', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf' },
  { name: 'Pacifico', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/pacifico/Pacifico-Regular.ttf' },
  { name: 'Raleway', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/Raleway%5Bwght%5D.ttf' },
  { name: 'Libre Baskerville', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/librebaskerville/LibreBaskerville%5Bwght%5D.ttf' },
  { name: 'Abril Fatface', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/abrilfatface/AbrilFatface-Regular.ttf' },
  { name: 'Cinzel Decorative', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cinzeldecorative/CinzelDecorative-Regular.ttf' },
  { name: 'Cause', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cause/Cause%5Bwght%5D.ttf' },
  { name: 'Cherry Bomb One', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/cherrybombone/CherryBombOne-Regular.ttf' },
  { name: 'DynaPuff', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/dynapuff/DynaPuff%5Bwdth%2Cwght%5D.ttf' },
  { name: 'Chewy', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/chewy/Chewy-Regular.ttf' },
  { name: 'Modak', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/modak/Modak-Regular.ttf' },
  { name: 'Molle', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/molle/Molle-Regular.ttf' },
  { name: 'Chango', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/chango/Chango-Regular.ttf' },
  { name: 'Crafty Girls', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/craftygirls/CraftyGirls-Regular.ttf' },
  { name: 'Snowburst One', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/snowburstone/SnowburstOne-Regular.ttf' },
  { name: 'Spicy Rice', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/spicyrice/SpicyRice-Regular.ttf' },
  { name: 'Emilys Candy', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/emilyscandy/EmilysCandy-Regular.ttf' },
  { name: 'Life Savers', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/lifesavers/LifeSavers-Regular.ttf' },
  { name: 'Sniglet', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sniglet/Sniglet-Regular.ttf' },
  { name: 'Coiny', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/coiny/Coiny-Regular.ttf' },
  { name: 'Hachi Maru Pop', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/hachimarupop/HachiMaruPop-Regular.ttf' },
  { name: 'Englebert', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/englebert/Englebert-Regular.ttf' },
  { name: 'Sour Gummy', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sourgummy/SourGummy%5Bwdth%2Cwght%5D.ttf' },
  { name: 'Unkempt', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/unkempt/Unkempt-Regular.ttf' },
  { name: 'Butterfly Kids', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/butterflykids/ButterflyKids-Regular.ttf' },
  { name: 'Mouse Memoirs', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/mousememoirs/MouseMemoirs-Regular.ttf' },
  { name: 'Atma', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/atma/Atma-Regular.ttf' },
  { name: 'Boogaloo', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/boogaloo/Boogaloo-Regular.ttf' },
  { name: 'Mystery Quest', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/mysteryquest/MysteryQuest-Regular.ttf' },
  { name: 'Ruge Boogie', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/rugeboogie/RugeBoogie-Regular.ttf' },
  { name: 'Damion', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/damion/Damion-Regular.ttf' },
  { name: 'Send Flowers', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/sendflowers/SendFlowers-Regular.ttf' },
  { name: 'Oi', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/oi/Oi-Regular.ttf' },
  { name: 'Chilanka', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/chilanka/Chilanka-Regular.ttf' },
  { name: 'Comic Neue', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/comicneue/ComicNeue-Regular.ttf' },
  { name: 'Dekko', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/dekko/Dekko-Regular.ttf' },
  { name: 'Autour One', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/autourone/AutourOne-Regular.ttf' },
  { name: 'Twinkle Star', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/twinklestar/TwinkleStar-Regular.ttf' },
  { name: 'Black And White Picture', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/blackandwhitepicture/BlackAndWhitePicture-Regular.ttf' },
  { name: 'Gluten', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/gluten/Gluten%5Bslnt%2Cwght%5D.ttf' },
  { name: 'Kavoon', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/kavoon/Kavoon-Regular.ttf' },
  { name: 'Miss Fajardose', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/missfajardose/MissFajardose-Regular.ttf' },
  { name: 'Slackey', url: 'https://raw.githubusercontent.com/google/fonts/main/apache/slackey/Slackey-Regular.ttf' },
  { name: 'Agbalumo', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/agbalumo/Agbalumo-Regular.ttf' },
  { name: 'Kablammo', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/kablammo/Kablammo%5BMORF%5D.ttf' },
  { name: 'Bagel Fat One', url: 'https://raw.githubusercontent.com/google/fonts/main/ofl/bagelfatone/BagelFatOne-Regular.ttf' },
];

export const JewelryCustomizer: React.FC = () => {
  // State
  const [selectedFont, setSelectedFont] = useState(AVAILABLE_FONTS[0]);
  const [text, setText] = useState('Fantistic');
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
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row">
        {/* Left: Controls */}
        <div className="w-full flex-none lg:w-[21rem]">
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
            onExport={handleExport}
            availableFonts={AVAILABLE_FONTS}
            selectedFont={selectedFont}
            setSelectedFont={setSelectedFont}
            isProcessing={processing}
            diagnostics={geometry?.diagnostics ?? null}
          />
        </div>

        {/* Right: Canvas */}
        <div className="tool-section flex min-h-[400px] flex-1 flex-col p-4">
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
                position={position}
                rotation={rotation}
                scale={scale}
                geometry={geometry}
                onTransformChange={(attrs) => {
                  setPosition({ x: attrs.x, y: attrs.y });
                  setRotation(attrs.rotation);
                  setScale(attrs.scale);
                }}
              />
            )}
          </div>
          <div className="mt-2 text-xs text-slate-400 text-center">
            最终预览 • 可拖拽 • 滚轮缩放
          </div>
        </div>
      </div>
    </div>
  );
};

// Default export for lazy loading compatibility if needed
export default JewelryCustomizer;
