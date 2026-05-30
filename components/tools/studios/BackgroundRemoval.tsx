import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Download, RefreshCw, Brush, Paintbrush, Pipette } from 'lucide-react';

type BrushMode = 'erase' | 'restore' | 'none';

export const BackgroundRemoval: React.FC = () => {
  // States
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [keyColor, setKeyColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [tolerance, setTolerance] = useState(25);
  const [feather, setFeather] = useState(5);
  const [bgPreview, setBgPreview] = useState<'grid' | 'white' | 'dark' | 'blue' | 'sunset'>('grid');
  
  // Brush config
  const [brushMode, setBrushMode] = useState<BrushMode>('none');
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPickingColor, setIsPickingColor] = useState(false);

  // Canvas refs
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseMaskCanvasRef = useRef<HTMLCanvasElement>(null);
  const userEditsCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Combine Original image, Base Mask, and User Edits into Display Canvas
  const renderCombinedResult = useCallback(() => {
    const origCanvas = originalCanvasRef.current;
    const baseMask = baseMaskCanvasRef.current;
    const userEdits = userEditsCanvasRef.current;
    const displayCanvas = displayCanvasRef.current;

    if (!origCanvas || !baseMask || !userEdits || !displayCanvas) return;

    const w = origCanvas.width;
    const h = origCanvas.height;

    displayCanvas.width = w;
    displayCanvas.height = h;

    const displayCtx = displayCanvas.getContext('2d');
    if (!displayCtx) return;

    // Create a temporary composited mask canvas
    const tempMask = document.createElement('canvas');
    tempMask.width = w;
    tempMask.height = h;
    const tempCtx = tempMask.getContext('2d');
    if (!tempCtx) return;

    // 1. Draw base auto mask onto temp mask
    tempCtx.drawImage(baseMask, 0, 0);

    // 2. Draw user edits onto temp mask
    tempCtx.drawImage(userEdits, 0, 0);

    // 3. Render final output: Draw original image, then composite in the mask
    displayCtx.drawImage(origCanvas, 0, 0);
    displayCtx.globalCompositeOperation = 'destination-in';
    displayCtx.drawImage(tempMask, 0, 0);
    displayCtx.globalCompositeOperation = 'source-over';
  }, []);

  // Compute Chroma Key Base Mask
  const computeChromaKey = useCallback(() => {
    const origCanvas = originalCanvasRef.current;
    const baseMask = baseMaskCanvasRef.current;
    if (!origCanvas || !baseMask || !keyColor) return;

    const w = origCanvas.width;
    const h = origCanvas.height;

    const origCtx = origCanvas.getContext('2d');
    const maskCtx = baseMask.getContext('2d');
    if (!origCtx || !maskCtx) return;

    const imgData = origCtx.getImageData(0, 0, w, h);
    const pixels = imgData.data;

    const maskData = maskCtx.createImageData(w, h);
    const maskPixels = maskData.data;

    const kr = keyColor.r;
    const kg = keyColor.g;
    const kb = keyColor.b;

    // Tolerance range
    const maxDist = tolerance * 2.55; 
    const featherDist = feather * 2.55;

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      const dist = Math.sqrt((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2);

      let alpha = 255;
      if (dist < maxDist) {
        alpha = 0;
      } else if (dist < maxDist + featherDist && featherDist > 0) {
        const t = (dist - maxDist) / featherDist;
        alpha = Math.floor(t * 255);
      }

      maskPixels[i] = alpha;     // R
      maskPixels[i + 1] = alpha; // G
      maskPixels[i + 2] = alpha; // B
      maskPixels[i + 3] = 255;   // Opaque mask image
    }

    maskCtx.putImageData(maskData, 0, 0);
  }, [keyColor, tolerance, feather]);

  // Handle uploading image
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageSrc(e.target.result as string);
        setKeyColor(null);
        setBrushMode('none');
      }
    };
    reader.readAsDataURL(file);
  };

  // Set up canvases when image loads
  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      imgRef.current = img;

      // Init original canvas
      const origCanvas = originalCanvasRef.current;
      if (origCanvas) {
        origCanvas.width = img.width;
        origCanvas.height = img.height;
        const ctx = origCanvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      }

      // Init base mask (opaque white by default)
      const baseMask = baseMaskCanvasRef.current;
      if (baseMask) {
        baseMask.width = img.width;
        baseMask.height = img.height;
        const ctx = baseMask.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, img.width, img.height);
        }
      }

      // Init user edits canvas (completely transparent)
      const userEdits = userEditsCanvasRef.current;
      if (userEdits) {
        userEdits.width = img.width;
        userEdits.height = img.height;
        const ctx = userEdits.getContext('2d');
        ctx?.clearRect(0, 0, img.width, img.height);
      }

      renderCombinedResult();
    };
  }, [imageSrc, renderCombinedResult]);

  // Re-run chroma keying when keyColor, tolerance, or feather changes
  useEffect(() => {
    if (keyColor) {
      computeChromaKey();
      renderCombinedResult();
    }
  }, [keyColor, computeChromaKey, renderCombinedResult]);

  // Eye-dropper click color picking
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPickingColor || !originalCanvasRef.current || !displayCanvasRef.current) return;

    const canvas = displayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Convert click coordinates to canvas space
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * canvas.height);

    const origCtx = originalCanvasRef.current.getContext('2d');
    if (origCtx) {
      const pixel = origCtx.getImageData(x, y, 1, 1).data;
      setKeyColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
      setIsPickingColor(false);
      setBrushMode('none');
    }
  };

  // Brush drawing handlers
  const handleDrawingStart = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (brushMode === 'none' || isPickingColor || !userEditsCanvasRef.current) return;
    setIsDrawing(true);
    drawBrushStroke(e);
  };

  const handleDrawingMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    drawBrushStroke(e);
  };

  const handleDrawingEnd = () => {
    setIsDrawing(false);
    renderCombinedResult();
  };

  const drawBrushStroke = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    const userEdits = userEditsCanvasRef.current;
    if (!canvas || !userEdits) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const ctx = userEdits.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (brushMode === 'erase') {
      // Erase brushes paint BLACK onto the mask (forcing alpha transparent)
      ctx.fillStyle = 'rgba(0, 0, 0, 1)';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (brushMode === 'restore') {
      // Restore brushes paint WHITE onto the mask (forcing alpha opaque)
      ctx.fillStyle = 'rgba(255, 255, 255, 1)';
      ctx.beginPath();
      ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Live update the display canvas while drawing for fluid feedback!
    renderCombinedResult();
  };

  // Trigger downloading PNG
  const downloadPng = () => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = 'cutout_result.png';
    link.click();
  };

  const handleReset = () => {
    setImageSrc(null);
    setKeyColor(null);
    setBrushMode('none');
  };

  const keyColorHex = keyColor 
    ? `#${((1 << 24) + (keyColor.r << 16) + (keyColor.g << 8) + keyColor.b).toString(16).slice(1)}` 
    : '';

  // Classify background preview style
  const getBgStyle = () => {
    switch (bgPreview) {
      case 'white':
        return 'bg-white';
      case 'dark':
        return 'bg-slate-900';
      case 'blue':
        return 'bg-gradient-to-tr from-sky-400 to-indigo-500';
      case 'sunset':
        return 'bg-gradient-to-tr from-amber-400 to-rose-500';
      case 'grid':
      default:
        return 'bg-checkerboard';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
      
      {/* Visual Canvas Workbench */}
      <div className="lg:col-span-2 relative flex flex-col rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 overflow-hidden shadow-inner justify-center items-center p-4">
        {imageSrc ? (
          <div className="relative w-full max-w-[600px] h-[400px] lg:h-[550px] flex items-center justify-center">
            {/* Display Canvas with preview backdrop */}
            <div className={`relative max-w-full max-h-full rounded-lg shadow-md overflow-hidden ${getBgStyle()}`}>
              <canvas
                ref={displayCanvasRef}
                onClick={handleCanvasClick}
                onMouseDown={handleDrawingStart}
                onMouseMove={handleDrawingMove}
                onMouseUp={handleDrawingEnd}
                onMouseLeave={handleDrawingEnd}
                className={`max-w-full max-h-[380px] lg:max-h-[520px] block ${isPickingColor ? 'cursor-crosshair' : brushMode !== 'none' ? 'cursor-none' : 'cursor-default'}`}
              />
            </div>
            
            {/* Color picker cursor notification */}
            {isPickingColor && (
              <div className="absolute top-4 bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow z-10 animate-bounce">
                请在图片上点击你想去除的背景色
              </div>
            )}
          </div>
        ) : (
          /* Initial Upload Area */
          <div className="w-full max-w-md p-8 text-center border-2 border-dashed border-slate-300 hover:border-primary-500 rounded-xl bg-white dark:bg-slate-900 transition-all cursor-pointer">
            <label className="flex flex-col items-center gap-3 cursor-pointer">
              <div className="h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 dark:bg-primary-950/40">
                <Upload className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">上传你想抠图的图片</span>
                <span className="block text-xs text-slate-400 mt-1">支持 PNG, JPG, JPEG 格式，100% 浏览器本地化处理</span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </label>
          </div>
        )}
      </div>

      {/* Configuration Sidebar Panel */}
      <div className="flex flex-col bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm max-h-[750px] overflow-y-auto">
        {imageSrc ? (
          <div className="flex flex-col h-full justify-between gap-6">
            <div className="space-y-5">
              
              {/* Chroma Key Selector */}
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">背景色去除 (Chroma Key)</h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setIsPickingColor(true);
                      setBrushMode('none');
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-lg border transition-all ${isPickingColor ? 'bg-primary-500 text-white border-primary-500 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800'}`}
                  >
                    <Pipette className="w-3.5 h-3.5" />
                    <span>吸色背景抠除</span>
                  </button>
                  {keyColor && (
                    <div 
                      className="w-8 h-8 rounded-lg border border-slate-200 shadow-sm"
                      style={{ backgroundColor: keyColorHex }}
                      title={`选定色: ${keyColorHex}`}
                    />
                  )}
                </div>
              </div>

              {/* Advanced Sliders */}
              {keyColor && (
                <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">抠像阈值调节</h4>
                  
                  {/* Tolerance */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600 dark:text-slate-400">抠除容差 (Tolerance)</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{tolerance}</span>
                    </div>
                    <input
                      type="range" min="1" max="100"
                      value={tolerance}
                      onChange={(e) => setTolerance(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>

                  {/* Feather */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600 dark:text-slate-400">边缘羽化 (Feather)</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{feather}</span>
                    </div>
                    <input
                      type="range" min="0" max="40"
                      value={feather}
                      onChange={(e) => setFeather(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>
                </div>
              )}

              {/* Manual Brush Tool */}
              <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase">画笔精细修正</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setBrushMode('erase');
                      setIsPickingColor(false);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 border rounded-lg text-xs font-semibold transition-all ${brushMode === 'erase' ? 'bg-red-50 text-red-600 border-red-200 shadow-sm dark:bg-red-950/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700'}`}
                  >
                    <Brush className="w-3.5 h-3.5" />
                    <span>擦除背景</span>
                  </button>
                  <button
                    onClick={() => {
                      setBrushMode('restore');
                      setIsPickingColor(false);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-1.5 border rounded-lg text-xs font-semibold transition-all ${brushMode === 'restore' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm dark:bg-emerald-950/20' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700'}`}
                  >
                    <Paintbrush className="w-3.5 h-3.5" />
                    <span>画笔还原</span>
                  </button>
                </div>

                {brushMode !== 'none' && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-600 dark:text-slate-400">画笔粗细</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{brushSize}px</span>
                    </div>
                    <input
                      type="range" min="5" max="100"
                      value={brushSize}
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-primary-600"
                    />
                  </div>
                )}
              </div>

              {/* Backdrop Preview Selectors */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-500 uppercase">背景预览背景色</h4>
                <div className="grid grid-cols-5 gap-1">
                  {(['grid', 'white', 'dark', 'blue', 'sunset'] as const).map(bg => (
                    <button
                      key={bg}
                      onClick={() => setBgPreview(bg)}
                      className={`h-7 rounded border transition-all ${bgPreview === bg ? 'border-primary-500 ring-2 ring-primary-500/10' : 'border-slate-200 dark:border-slate-700'} ${bg === 'grid' ? 'bg-checkerboard' : bg === 'white' ? 'bg-white' : bg === 'dark' ? 'bg-slate-900' : bg === 'blue' ? 'bg-gradient-to-tr from-sky-400 to-indigo-500' : 'bg-gradient-to-tr from-amber-400 to-rose-500'}`}
                      title={bg}
                    />
                  ))}
                </div>
              </div>

            </div>

            {/* Actions Footer */}
            <div className="space-y-2 pt-6 border-t border-slate-100 dark:border-slate-800 flex-none">
              <button
                onClick={downloadPng}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>下载透明 PNG 图片</span>
              </button>
              <button
                onClick={handleReset}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>载入另一张图片</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-xs text-slate-400 py-12">
            请上传图片开始高精度本地抠图！
          </div>
        )}
      </div>

    </div>
  );
};
