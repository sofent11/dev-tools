import { useDraftState } from '../shared/useDraftState';
import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import React, { useState, useEffect, useRef } from 'react';
import { CanvasStage } from './CanvasStage';
import { ThreeStage } from './ThreeStage';
import { ControlPanel } from './ControlPanel';
import { generateGeometry, loadFont, GeometryResult } from './utils/geometry';
import { generateDxf } from './utils/dxf';
import { getDesignBounds } from './utils/designBounds';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as THREE from 'three';
import opentype from 'opentype.js';
import { Download, FileCode, RotateCcw } from 'lucide-react';
import { Button } from '../../ui/Button';
import { WorkflowNotice } from '../shared/WorkflowUi';
import { notifyToast } from '../shared/notifyToast';

/**
 * Converts an SVG path data string into a THREE.ShapePath
 * suitable for SVGLoader.createShapes().
 */
function svgPathToShapePath(d: string): THREE.ShapePath {
  const shapePath = new THREE.ShapePath();
  const firstPoint = new THREE.Vector2();
  const point = new THREE.Vector2();
  let isFirstPoint = true;

  const commands = d.match(/[a-df-z][^a-df-z]*/ig);
  if (!commands) return shapePath;

  for (const cmd of commands) {
    const type = cmd.charAt(0);
    const data = cmd.slice(1).trim();
    const nums = [...data.matchAll(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g)].map(m => parseFloat(m[0]));

    switch (type) {
      case 'M':
        shapePath.moveTo(nums[0], nums[1]);
        point.set(nums[0], nums[1]);
        if (isFirstPoint) {
          firstPoint.copy(point);
          isFirstPoint = false;
        }
        break;
      case 'L':
        for (let j = 0; j < nums.length; j += 2) {
          shapePath.lineTo(nums[j], nums[j + 1]);
          point.set(nums[j], nums[j + 1]);
        }
        break;
      case 'H':
        shapePath.lineTo(nums[0], point.y);
        point.x = nums[0];
        break;
      case 'V':
        shapePath.lineTo(point.x, nums[0]);
        point.y = nums[0];
        break;
      case 'C':
        for (let j = 0; j < nums.length; j += 6) {
          shapePath.bezierCurveTo(nums[j], nums[j + 1], nums[j + 2], nums[j + 3], nums[j + 4], nums[j + 5]);
          point.set(nums[j + 4], nums[j + 5]);
        }
        break;
      case 'Q':
        for (let j = 0; j < nums.length; j += 4) {
          shapePath.quadraticCurveTo(nums[j], nums[j + 1], nums[j + 2], nums[j + 3]);
          point.set(nums[j + 2], nums[j + 3]);
        }
        break;
      case 'Z':
      case 'z':
        if (shapePath.currentPath) {
          shapePath.currentPath.autoClose = true;
        }
        point.copy(firstPoint);
        isFirstPoint = true;
        break;
    }
  }

  return shapePath;
}

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
  useLocaleRender();
  // State
  const [selectedFont, setSelectedFont] = useState(AVAILABLE_FONTS[0]);
  const [text, setText] = useDraftState('components/tools/JewelryCustomizer/index.tsx:JewelryCustomizer:text', 'Atelier');
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
  
  const [position, setPosition] = useState({ x: 375, y: 275 });
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  
  const [font, setFont] = useState<opentype.Font | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const [geometryError, setGeometryError] = useState<string | null>(null);
  const [generatedFor, setGeneratedFor] = useState<{ key: string; font: opentype.Font } | null>(null);
  const [generationVersion, setGenerationVersion] = useState(0);
  const stageHostRef = useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = useState(750);
  const [viewVersion, setViewVersion] = useState(0);

  // 3D parameters and mode
  const [previewMode, setPreviewMode] = useState<'2d' | '3d' | 'split'>('2d');
  const [extrusionThicknessMm, setExtrusionThicknessMm] = useState(2);
  const [metalMaterial, setMetalMaterial] = useState<'gold' | 'platinum' | 'rose_gold' | 'silver'>('gold');

  // Hanging Loops and Backdrop Frames configuration states
  const [loopType, setLoopType] = useState<'none' | 'top' | 'double_side' | 'double_top'>('none');
  const [loopOuterDiameterMm, setLoopOuterDiameterMm] = useState(4.0);
  const [loopInnerDiameterMm, setLoopInnerDiameterMm] = useState(2.0);
  const [frameStyle, setFrameStyle] = useState<'none' | 'contour' | 'bar' | 'heart' | 'oval'>('none');
  const [framePaddingMm, setFramePaddingMm] = useState(2.0);
  const [frameMaterial, setFrameMaterial] = useState<'gold' | 'platinum' | 'rose_gold' | 'silver'>('silver');

  const geometryKey = JSON.stringify({ text, selectedFont: selectedFont.url, fontSize, unitsPerMm, offsetMm, minBridgeMm, bridgeMaxGapMm, flattenToleranceMm, letterSpacingMm, autoTighten, autoTightenMaxMm, loopType, loopOuterDiameterMm, loopInnerDiameterMm, frameStyle, framePaddingMm, generationVersion });
  const hasCurrentGeometry = Boolean(geometry?.processedPath && geometry.polygons.length && generatedFor?.key === geometryKey && generatedFor.font === font);
  const canExport = hasCurrentGeometry && !loading && !processing && !fontError && !geometryError && Boolean(text.trim());
  const resetParameters = () => {
    setFontSize(100); setOffsetMm(0.2); setLetterSpacingMm(0); setMinBridgeMm(1); setBridgeMaxGapMm(12); setFlattenToleranceMm(0.05); setAutoTighten(true); setAutoTightenMaxMm(1.5); setUnitsPerMm(3.78); setExtrusionThicknessMm(2); setMetalMaterial('gold'); setLoopType('none'); setLoopOuterDiameterMm(4); setLoopInnerDiameterMm(2); setFrameStyle('none'); setFramePaddingMm(2); setFrameMaterial('silver'); setRotation(0); setPosition({ x: 375, y: 275 }); setScale(1);
  };
  useEffect(() => {
    const host = stageHostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(entries => { const width = Math.floor(entries[0]?.contentRect.width || 750); setStageWidth(Math.max(1, width)); });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  // Load Font
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!selectedFont) return;

      setLoading(true);
      setFont(null);
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
    if (!font || !text.trim()) { setProcessing(false); setGeometry(null); setGeneratedFor(null); setGeometryError(null); return; }
    if (Array.from(text).length > 80) { setProcessing(false); setGeometry(null); setGeometryError('最多支持 80 个字符，请缩短文字。'); return; }
    const missing = [...new Set(Array.from(text).filter(char => !/\s/.test(char) && font.charToGlyphIndex(char) === 0))];
    if (missing.length) { setProcessing(false); setGeometry(null); setGeometryError(`${tr('当前字体不支持这些字符，请更换字体')}：${missing.join(' ')}`); return; }
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
          loopType,
          loopOuterDiameterMm,
          loopInnerDiameterMm,
          frameStyle,
          framePaddingMm,
        });
        setGeometry(result);
        setGeneratedFor({ key: geometryKey, font });
        setGeometryError(null);
      } catch (e) {
        setGeometry(null);
        setGeometryError(e instanceof Error ? e.message : '几何生成失败，请调整参数后重试。');
      } finally {
        setProcessing(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [text, fontSize, offsetMm, letterSpacingMm, minBridgeMm, bridgeMaxGapMm, flattenToleranceMm, autoTighten, autoTightenMaxMm, unitsPerMm, font, loopType, loopOuterDiameterMm, loopInnerDiameterMm, frameStyle, framePaddingMm, geometryKey]);

  const handleExportSvg = () => {
    if (!canExport || !geometry) return;

    try {
    const bounds = getDesignBounds(geometry.polygons);
    const { width, height } = bounds;
    const pad = 10;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${(width + pad * 2) / unitsPerMm}mm" height="${(height + pad * 2) / unitsPerMm}mm" viewBox="${bounds.minX - pad} ${bounds.minY - pad} ${width + pad * 2} ${height + pad * 2}">\n` +
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
    } catch (error) { setGeometryError(error instanceof Error ? error.message : tr('SVG 导出失败')); }
  };

  const handleExportDxf = () => {
    if (!canExport || !geometry) return;
    try {
      const dxfString = generateDxf(geometry.polygons, unitsPerMm);
      const blob = new Blob([dxfString], { type: 'application/dxf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jewelry_design_${Date.now()}.dxf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      notifyToast({ title: '导出 DXF 失败', description: e instanceof Error ? e.message : '请检查当前几何后重试。', tone: 'error' });
    }
  };

  const handleExportStl = () => {
    if (!canExport || !geometry) return;
    const ownedGeometries: THREE.BufferGeometry[] = [];
    const ownedMaterials: THREE.Material[] = [];
    try {
      const group = new THREE.Group();
      const { centerX, centerY } = getDesignBounds(geometry.polygons);
      
      const hasFrame = geometry.framePath ? true : false;
      const frameDepth = hasFrame ? extrusionThicknessMm * 0.4 * unitsPerMm : 0;
      const textDepth = extrusionThicknessMm * unitsPerMm;

      // 1. Extrude Text
      const textPathStr = geometry.textPath || geometry.processedPath;
      if (!textPathStr) return;
      const textShapes = SVGLoader.createShapes(svgPathToShapePath(textPathStr));
      const textSettings: THREE.ExtrudeGeometryOptions = {
        depth: textDepth,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.03 * unitsPerMm,
        bevelThickness: 0.05 * unitsPerMm,
      };
      const textGeo = new THREE.ExtrudeGeometry(textShapes, textSettings);
      ownedGeometries.push(textGeo);
      textGeo.translate(-centerX, -centerY, -textDepth / 2);
      const textMesh = new THREE.Mesh(textGeo);
      ownedMaterials.push(...(Array.isArray(textMesh.material) ? textMesh.material : [textMesh.material]));
      group.add(textMesh);

      // 2. Extrude Frame
      let frameGeo: THREE.ExtrudeGeometry | null = null;
      if (hasFrame && geometry.framePath) {
        const frameShapes = SVGLoader.createShapes(svgPathToShapePath(geometry.framePath));
        const frameSettings: THREE.ExtrudeGeometryOptions = {
          depth: frameDepth,
          bevelEnabled: true,
          bevelSegments: 4,
          steps: 1,
          bevelSize: 0.03 * unitsPerMm,
          bevelThickness: 0.05 * unitsPerMm,
        };
        frameGeo = new THREE.ExtrudeGeometry(frameShapes, frameSettings);
        ownedGeometries.push(frameGeo);
        frameGeo.translate(-centerX, -centerY, -frameDepth / 2);
        const frameMesh = new THREE.Mesh(frameGeo);
        ownedMaterials.push(...(Array.isArray(frameMesh.material) ? frameMesh.material : [frameMesh.material]));
        group.add(frameMesh);
      }

      // 3. Align Z positions
      if (frameGeo && group.children.length >= 2) {
        group.children[1].position.set(0, 0, -textDepth / 2);
        group.children[0].position.set(0, 0, frameDepth / 2);
      } else {
        group.children[0].position.set(0, 0, 0);
      }

      // 4. Scale to exact millimeter units for 3D printing
      group.scale.set(1 / unitsPerMm, -1 / unitsPerMm, -1 / unitsPerMm);

      // 5. Parse group with STLExporter
      const exporter = new STLExporter();
      const result = exporter.parse(group, { binary: true }) as DataView;

      const blob = new Blob([result], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jewelry_design_3d_${Date.now()}.stl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (e) {
      notifyToast({ title: '导出 STL 失败', description: e instanceof Error ? e.message : '请检查当前几何后重试。', tone: 'error' });
    } finally { ownedGeometries.forEach(item => item.dispose()); ownedMaterials.forEach(item => item.dispose()); }
  };
  const stageHeight = Math.min(500, Math.max(300, Math.round(stageWidth * 0.65)));
  const previewGeometry = text.trim() && font && !fontError ? geometry : null;
  const halfWidth = Math.max(1, Math.floor((stageWidth - 16) / 2));
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <div className="grid min-h-0 flex-1 items-start gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="min-w-0">
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
            
            extrusionThicknessMm={extrusionThicknessMm}
            setExtrusionThicknessMm={setExtrusionThicknessMm}
            metalMaterial={metalMaterial}
            setMetalMaterial={setMetalMaterial}

            loopType={loopType}
            setLoopType={setLoopType}
            loopOuterDiameterMm={loopOuterDiameterMm}
            setLoopOuterDiameterMm={setLoopOuterDiameterMm}
            loopInnerDiameterMm={loopInnerDiameterMm}
            setLoopInnerDiameterMm={setLoopInnerDiameterMm}
            frameStyle={frameStyle}
            setFrameStyle={setFrameStyle}
            framePaddingMm={framePaddingMm}
            setFramePaddingMm={setFramePaddingMm}
            frameMaterial={frameMaterial}
            setFrameMaterial={setFrameMaterial}
            
            onReset={resetParameters}
            
            availableFonts={AVAILABLE_FONTS}
            selectedFont={selectedFont}
            setSelectedFont={setSelectedFont}
            diagnostics={hasCurrentGeometry ? geometry?.diagnostics ?? null : null}
          />
        </div>

        <section className="tool-section flex min-w-0 flex-col gap-4 p-4 xl:sticky xl:top-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
            <h3 className="text-sm font-semibold">{tr("设计预览")}</h3>
            <div className="flex flex-wrap gap-1">{[{ mode: '2d' as const, label: tr('2D 图纸') }, { mode: '3d' as const, label: tr('3D 材质') }, { mode: 'split' as const, label: tr('双视图') }].map(item => <Button key={item.mode} size="sm" variant={previewMode === item.mode ? 'primary' : 'ghost'} aria-pressed={previewMode === item.mode} onClick={() => setPreviewMode(item.mode)}>{item.label}</Button>)}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500" aria-live="polite"><span>{tr(selectedFont.name)}</span><span>·</span><span>{extrusionThicknessMm} mm</span><span className="ml-auto">{loading ? tr('正在加载字体…') : !text.trim() || fontError ? tr('等待文字与字体') : processing || (!hasCurrentGeometry && !geometryError) ? tr('正在更新几何…') : canExport ? tr('几何已就绪') : tr('等待文字与字体')}</span></div>
          {fontError && <WorkflowNotice tone="error"><div className="space-y-2"><p>{tr(fontError)}</p><Button size="sm" variant="secondary" onClick={() => setSelectedFont({ ...selectedFont })}>{tr("重新加载字体")}</Button></div></WorkflowNotice>}
          {hasCurrentGeometry && geometry && geometry.diagnostics.componentsAfterRepair > 1 && <WorkflowNotice>{tr("文字轮廓仍有多个连通分量；挂耳、底框与打印强度需另行复检。")}</WorkflowNotice>}
          {geometryError && <WorkflowNotice tone="error"><div className="space-y-2"><p>{tr(geometryError)}</p><Button size="sm" variant="secondary" onClick={() => setGenerationVersion(version => version + 1)}>{tr("重新生成几何")}</Button></div></WorkflowNotice>}
          <div ref={stageHostRef} className="relative min-h-[300px] min-w-0 w-full">
            {loading ? <div className="flex min-h-[300px] items-center justify-center rounded-lg border bg-slate-50 text-sm text-slate-400">{tr("正在加载所选字体…")}</div> : fontError ? <div className="flex min-h-[300px] flex-col items-center justify-center gap-2 rounded-lg border bg-slate-50 p-6 text-center"><p className="text-sm font-medium">{tr("选择其他字体或重新加载")}</p><p className="text-xs text-slate-500">{tr("生产预览需要可解析的 TTF/OTF 字体文件。")}</p></div> : !text.trim() ? <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-slate-400">{tr("输入名字或短句，开始生成首饰。")}</div> : previewMode === 'split' ? <div className="grid gap-4" style={{ gridTemplateColumns: stageWidth >= 640 ? 'minmax(0,1fr) minmax(0,1fr)' : 'minmax(0,1fr)' }}>
              <div className="min-w-0"><CanvasStage width={750} height={500} position={position} rotation={rotation} scale={scale} geometry={previewGeometry} onTransformChange={attrs => { setPosition({ x: attrs.x, y: attrs.y }); setRotation(attrs.rotation); setScale(attrs.scale); }} /></div>
              <div className="min-w-0 overflow-hidden"><ThreeStage key={viewVersion} width={stageWidth < 640 ? stageWidth : halfWidth} height={stageHeight} geometry={previewGeometry} thicknessMm={extrusionThicknessMm} unitsPerMm={unitsPerMm} materialType={metalMaterial} frameMaterialType={frameMaterial} /></div>
            </div> : previewMode === '3d' ? <ThreeStage key={viewVersion} width={stageWidth} height={stageHeight} geometry={previewGeometry} thicknessMm={extrusionThicknessMm} unitsPerMm={unitsPerMm} materialType={metalMaterial} frameMaterialType={frameMaterial} /> : <div className="w-full"><CanvasStage width={750} height={500} position={position} rotation={rotation} scale={scale} geometry={previewGeometry} onTransformChange={attrs => { setPosition({ x: attrs.x, y: attrs.y }); setRotation(attrs.rotation); setScale(attrs.scale); }} /></div>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{previewMode === '2d' ? tr('拖拽图形移动 · 滚轮缩放') : tr('拖拽旋转 · 右键平移 · 滚轮缩放')}</span><Button size="xs" variant="ghost" onClick={() => { setPosition({ x: 375, y: 275 }); setRotation(0); setScale(1); setViewVersion(version => version + 1); }} icon={<RotateCcw className="h-3 w-3" />}>{tr("重置视图")}</Button></div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div><h4 className="text-sm font-semibold">{tr("导出当前设计")}</h4><p className="mt-1 text-xs text-slate-500">{tr("SVG / DXF 按毫米导出二维图纸；STL 是实验级实体，打印前需复检。")}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={!canExport} onClick={handleExportSvg} icon={<Download className="h-4 w-4" />}>SVG</Button><Button size="sm" variant="secondary" disabled={!canExport} onClick={handleExportDxf} icon={<FileCode className="h-4 w-4" />}>DXF</Button><Button size="sm" disabled={!canExport} onClick={handleExportStl} icon={<Download className="h-4 w-4" />}>{tr("导出 STL")}</Button></div></div>
        </section>
      </div>
    </div>
  );
};

// Default export for lazy loading compatibility if needed
export default JewelryCustomizer;
