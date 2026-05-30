import React, { useState, useEffect } from 'react';
import { Type, Settings, Download, Eye, Box, Sparkles, FileCode, Split, Check } from 'lucide-react';

interface ControlPanelProps {
  text: string;
  setText: (s: string) => void;
  fontSize: number;
  setFontSize: (n: number) => void;
  offsetMm: number;
  setOffsetMm: (n: number) => void;
  letterSpacingMm: number;
  setLetterSpacingMm: (n: number) => void;
  minBridgeMm: number;
  setMinBridgeMm: (n: number) => void;
  bridgeMaxGapMm: number;
  setBridgeMaxGapMm: (n: number) => void;
  flattenToleranceMm: number;
  setFlattenToleranceMm: (n: number) => void;
  autoTighten: boolean;
  setAutoTighten: (v: boolean) => void;
  autoTightenMaxMm: number;
  setAutoTightenMaxMm: (n: number) => void;
  unitsPerMm: number;
  setUnitsPerMm: (n: number) => void;
  
  // 3D Preview states
  previewMode: '2d' | '3d' | 'split';
  setPreviewMode: (m: '2d' | '3d' | 'split') => void;
  extrusionThicknessMm: number;
  setExtrusionThicknessMm: (n: number) => void;
  metalMaterial: 'gold' | 'platinum' | 'rose_gold' | 'silver';
  setMetalMaterial: (m: 'gold' | 'platinum' | 'rose_gold' | 'silver') => void;

  // New Loop and Frame states
  loopType: 'none' | 'top' | 'double_side' | 'double_top';
  setLoopType: (t: 'none' | 'top' | 'double_side' | 'double_top') => void;
  loopOuterDiameterMm: number;
  setLoopOuterDiameterMm: (n: number) => void;
  loopInnerDiameterMm: number;
  setLoopInnerDiameterMm: (n: number) => void;
  frameStyle: 'none' | 'contour' | 'bar' | 'heart' | 'oval';
  setFrameStyle: (s: 'none' | 'contour' | 'bar' | 'heart' | 'oval') => void;
  framePaddingMm: number;
  setFramePaddingMm: (n: number) => void;
  frameMaterial: 'gold' | 'platinum' | 'rose_gold' | 'silver';
  setFrameMaterial: (m: 'gold' | 'platinum' | 'rose_gold' | 'silver') => void;

  // Exports
  onExportSvg: () => void;
  onExportDxf: () => void;
  onExportStl: () => void;

  availableFonts: Array<{ name: string; url: string }>;
  selectedFont: { name: string; url: string } | null;
  setSelectedFont: (font: { name: string; url: string }) => void;
  isProcessing: boolean;
  diagnostics: {
    componentsBeforeRepair: number;
    componentsAfterRepair: number;
    appliedLetterSpacingMm: number;
    usedBridgeCount: number;
  } | null;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  text, setText,
  fontSize, setFontSize,
  offsetMm, setOffsetMm,
  letterSpacingMm, setLetterSpacingMm,
  minBridgeMm, setMinBridgeMm,
  bridgeMaxGapMm, setBridgeMaxGapMm,
  flattenToleranceMm, setFlattenToleranceMm,
  autoTighten, setAutoTighten,
  autoTightenMaxMm, setAutoTightenMaxMm,
  unitsPerMm, setUnitsPerMm,
  
  previewMode, setPreviewMode,
  extrusionThicknessMm, setExtrusionThicknessMm,
  metalMaterial, setMetalMaterial,

  loopType, setLoopType,
  loopOuterDiameterMm, setLoopOuterDiameterMm,
  loopInnerDiameterMm, setLoopInnerDiameterMm,
  frameStyle, setFrameStyle,
  framePaddingMm, setFramePaddingMm,
  frameMaterial, setFrameMaterial,
  
  onExportSvg,
  onExportDxf,
  onExportStl,

  availableFonts,
  selectedFont,
  setSelectedFont,
  isProcessing,
  diagnostics,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'elegant' | 'script' | 'cute' | 'modern'>('all');

  // Inject font-faces dynamically into document header for live typography card previews
  useEffect(() => {
    const styleId = 'jewelry-fonts-fontface';
    let styleTag = document.getElementById(styleId) as HTMLStyleElement;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    let rules = '';
    availableFonts.forEach((font) => {
      rules += `
        @font-face {
          font-family: '${font.name}';
          src: url('${font.url}') format('truetype');
          font-display: swap;
        }
      `;
    });
    styleTag.textContent = rules;
  }, [availableFonts]);

  const classifyFont = (name: string): 'elegant' | 'script' | 'cute' | 'modern' => {
    const elegantFonts = ['Cinzel', 'Playfair Display', 'Libre Baskerville', 'Abril Fatface', 'Cinzel Decorative'];
    const scriptFonts = ['Great Vibes', 'Pacifico', 'Send Flowers', 'Miss Fajardose', 'Molle', 'Chilanka', 'Twinkle Star', 'Mystery Quest', 'Ruge Boogie', 'Damion'];
    const cuteFonts = ['DynaPuff', 'Chewy', 'Modak', 'Chango', 'Crafty Girls', 'Emilys Candy', 'Sniglet', 'Coiny', 'Hachi Maru Pop', 'Cherry Bomb One', 'Sour Gummy'];
    
    if (elegantFonts.some(f => name.includes(f))) return 'elegant';
    if (scriptFonts.some(f => name.includes(f))) return 'script';
    if (cuteFonts.some(f => name.includes(f))) return 'cute';
    return 'modern';
  };

  const filteredFonts = availableFonts.filter((font) => {
    if (activeCategory === 'all') return true;
    return classifyFont(font.name) === activeCategory;
  });

  return (
    <div className="tool-section app-scrollbar flex h-full flex-col gap-5 overflow-y-auto p-5">
      
      {/* Header */}
      <div className="pb-4 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-600 animate-spin-slow" />
          定制参数
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          调整参数以满足生产制造及3D渲染要求
        </p>
      </div>
      {/* Preview Mode Switcher */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Eye className="w-4 h-4 text-slate-500" /> 预览模式
        </label>
        <div className="grid grid-cols-3 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setPreviewMode('2d')}
            className={`inline-flex h-8 items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold transition-colors ${
              previewMode === '2d' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            2D 矢量
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('3d')}
            className={`inline-flex h-8 items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold transition-colors ${
              previewMode === '3d' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            3D 效果
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('split')}
            className={`inline-flex h-8 items-center justify-center gap-1 rounded-md px-1 text-[11px] font-semibold transition-colors ${
              previewMode === 'split' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Split className="h-3.5 w-3.5" />
            联动分屏
          </button>
        </div>
      </div>

      {/* Text Input & Visual Font Picker */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Type className="w-4 h-4" /> 定制文字
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-100 focus:border-primary-400 min-h-16 text-sm"
            placeholder="请输入文字..."
          />
        </div>

        <div className="space-y-2.5">
          <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Type className="w-4 h-4 text-indigo-500" /> 艺术字形选择
            </span>
            <span className="text-[10px] text-slate-400">{filteredFonts.length} 款可用</span>
          </label>

          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1.5 app-scrollbar">
            {[
              { id: 'all', label: '全部' },
              { id: 'elegant', label: '高雅' },
              { id: 'script', label: '手写' },
              { id: 'cute', label: '卡通' },
              { id: 'modern', label: '现代' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as 'all' | 'elegant' | 'script' | 'cute' | 'modern')}
                className={`px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all whitespace-nowrap cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Visual Font Grid */}
          <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1 border border-slate-200 rounded-lg p-2 bg-slate-50/50 app-scrollbar">
            {filteredFonts.map((font) => {
              const isSelected = selectedFont?.name === font.name;
              return (
                <button
                  key={font.name}
                  type="button"
                  onClick={() => setSelectedFont(font)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all relative cursor-pointer ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                      <Check className="w-2.5 h-2.5" />
                    </span>
                  )}
                  <span
                    className="text-base font-medium text-slate-800 mb-1 leading-none select-none max-w-full truncate"
                    style={{ fontFamily: `'${font.name}'` }}
                  >
                    {text ? text.slice(0, 4) : 'Aa'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium truncate max-w-full">
                    {font.name.replace(' (自动加固)', '')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3D Extrusion parameters */}
      {(previewMode === '3d' || previewMode === 'split') && (
        <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5" /> 3D 立体模型参数
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <label className="font-medium text-slate-700">首饰厚度 (Thickness)</label>
              <span className="text-indigo-600 font-semibold">{extrusionThicknessMm}mm</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={extrusionThicknessMm}
              onChange={(e) => setExtrusionThicknessMm(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600">文字材质 (Text)</label>
              <select
                value={metalMaterial}
                onChange={(e) => setMetalMaterial(e.target.value as 'gold' | 'platinum' | 'rose_gold' | 'silver')}
                className="w-full px-2 py-1 text-xs border border-indigo-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-100"
              >
                <option value="gold">黄金 (Gold)</option>
                <option value="platinum">白金 (Platinum)</option>
                <option value="rose_gold">玫瑰金 (Rose)</option>
                <option value="silver">纯银 (Silver)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-600">底框材质 (Backing)</label>
              <select
                value={frameMaterial}
                onChange={(e) => setFrameMaterial(e.target.value as 'gold' | 'platinum' | 'rose_gold' | 'silver')}
                className="w-full px-2 py-1 text-xs border border-indigo-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-100"
                disabled={frameStyle === 'none'}
              >
                <option value="gold">黄金 (Gold)</option>
                <option value="platinum">白金 (Platinum)</option>
                <option value="rose_gold">玫瑰金 (Rose)</option>
                <option value="silver">纯银 (Silver)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Loop & Frame settings */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 text-indigo-500 animate-spin-slow" />
          首饰连接挂件 & 一体化底框
        </h3>

        {/* Backdrop Frame Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            底框底板样式
          </label>
          <select
            value={frameStyle}
            onChange={(e) => setFrameStyle(e.target.value as 'none' | 'contour' | 'bar' | 'heart' | 'oval')}
            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-100"
          >
            <option value="none">无底框 (仅文本)</option>
            <option value="contour">气泡轮廓底板 (Contour)</option>
            <option value="bar">圆角一体横条 (Rounded Bar)</option>
            <option value="oval">高雅椭圆底板 (Oval Plate)</option>
            <option value="heart">唯美爱心底板 (Heart Plate)</option>
          </select>
        </div>

        {/* Backing Frame padding slider */}
        {frameStyle !== 'none' && (
          <div className="space-y-2 pl-2 border-l-2 border-indigo-100">
            <div className="flex justify-between text-xs">
              <label className="font-medium text-slate-600">底板宽度留边 (Padding)</label>
              <span className="text-indigo-600 font-semibold">{framePaddingMm}mm</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.5"
              value={framePaddingMm}
              onChange={(e) => setFramePaddingMm(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
        )}

        {/* Loop Type Selection */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            首饰连接挂耳 / 吊坠孔
          </label>
          <select
            value={loopType}
            onChange={(e) => setLoopType(e.target.value as 'none' | 'top' | 'double_side' | 'double_top')}
            className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:ring-2 focus:ring-indigo-100"
          >
            <option value="none">无挂件孔 (纯文本/贴片)</option>
            <option value="top">单吊坠孔 (正上方居中)</option>
            <option value="double_side">项链双耳挂钩 (左右两侧)</option>
            <option value="double_top">项链双吊耳 (上方左右)</option>
          </select>
        </div>

        {/* Loop diameter sliders */}
        {loopType !== 'none' && (
          <div className="space-y-3 pl-2 border-l-2 border-indigo-100">
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <label className="font-medium text-slate-600">挂耳外径 (Outer Diameter)</label>
                <span className="text-indigo-600 font-semibold">{loopOuterDiameterMm}mm</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="6.0"
                step="0.1"
                value={loopOuterDiameterMm}
                onChange={(e) => setLoopOuterDiameterMm(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <label className="font-medium text-slate-600">挂耳内孔径 (Chain Hole)</label>
                <span className="text-indigo-600 font-semibold">{loopInnerDiameterMm}mm</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="4.0"
                step="0.1"
                value={loopInnerDiameterMm}
                onChange={(e) => setLoopInnerDiameterMm(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
            </div>
          </div>
        )}
      </div>
      {/* Sliders */}
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-slate-700">字号 (Size)</label>
            <span className="text-slate-500">{fontSize}px</span>
          </div>
          <input
            type="range"
            min="20"
            max="200"
            step="1"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-slate-700">增粗 (Offset)</label>
            <span className="text-slate-500">{offsetMm}mm</span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={offsetMm}
            onChange={(e) => setOffsetMm(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <p className="text-xs text-slate-400">
            增加线条粗细以满足工艺最小线宽要求
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-slate-700">字距 (Letter Spacing)</label>
            <span className="text-slate-500">{letterSpacingMm}mm</span>
          </div>
          <input
            type="range"
            min="-2"
            max="4"
            step="0.05"
            value={letterSpacingMm}
            onChange={(e) => setLetterSpacingMm(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-slate-700">最小连桥宽度</label>
            <span className="text-slate-500">{minBridgeMm}mm</span>
          </div>
          <input
            type="range"
            min="0.3"
            max="3"
            step="0.05"
            value={minBridgeMm}
            onChange={(e) => setMinBridgeMm(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-slate-700">桥接最大间隙</label>
            <span className="text-slate-500">{bridgeMaxGapMm}mm</span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={bridgeMaxGapMm}
            onChange={(e) => setBridgeMaxGapMm(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-slate-700">扁平化误差</label>
            <span className="text-slate-500">{flattenToleranceMm}mm</span>
          </div>
          <input
            type="range"
            min="0.02"
            max="0.5"
            step="0.01"
            value={flattenToleranceMm}
            onChange={(e) => setFlattenToleranceMm(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">自动压缩字距以连通</label>
            <input
              type="checkbox"
              checked={autoTighten}
              onChange={(e) => setAutoTighten(e.target.checked)}
              className="h-4 w-4"
            />
          </div>
          <div className="flex justify-between text-sm">
            <label className="font-medium text-slate-700">最大压缩量</label>
            <span className="text-slate-500">{autoTightenMaxMm}mm</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.1"
            value={autoTightenMaxMm}
            onChange={(e) => setAutoTightenMaxMm(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
            disabled={!autoTighten}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <label className="font-medium text-slate-700">单位换算 (units/mm)</label>
            <span className="text-slate-500">{unitsPerMm}</span>
          </div>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={unitsPerMm}
            onChange={(e) => setUnitsPerMm(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>
      </div>

      {diagnostics && (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-3 space-y-1">
          <div>连通分量：{diagnostics.componentsBeforeRepair} → {diagnostics.componentsAfterRepair}</div>
          <div>应用字距：{diagnostics.appliedLetterSpacingMm.toFixed(2)}mm</div>
          <div>桥接数量：{diagnostics.usedBridgeCount}</div>
        </div>
      )}

      <div className="flex-1" />

      {/* Action Group */}
      <div className="space-y-2 border-t border-slate-100 pt-4">
        <div className="text-xs font-semibold text-slate-400 mb-1">矢量图纸导出 (2D CAD)</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onExportSvg}
            disabled={isProcessing || !text}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> SVG 格式
          </button>
          <button
            onClick={onExportDxf}
            disabled={isProcessing || !text}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5" /> DXF 格式
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-400 mt-2 mb-1">三维实体导出 (3D Print)</div>
        <button
          onClick={onExportStl}
          disabled={isProcessing || !text}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-700 bg-indigo-600 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
        >
          {isProcessing ? (
            '计算中...'
          ) : (
            <>
              <Download className="w-4 h-4" /> 导出 STL 打印模型
            </>
          )}
        </button>
      </div>

    </div>
  );
};
