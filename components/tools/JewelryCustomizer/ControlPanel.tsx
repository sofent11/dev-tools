import React from 'react';
import { Type, Settings, Download, Eye, Box, Sparkles, FileCode } from 'lucide-react';

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
  previewMode: '2d' | '3d';
  setPreviewMode: (m: '2d' | '3d') => void;
  extrusionThicknessMm: number;
  setExtrusionThicknessMm: (n: number) => void;
  metalMaterial: 'gold' | 'platinum' | 'rose_gold' | 'silver';
  setMetalMaterial: (m: 'gold' | 'platinum' | 'rose_gold' | 'silver') => void;

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
  
  onExportSvg,
  onExportDxf,
  onExportStl,

  availableFonts,
  selectedFont,
  setSelectedFont,
  isProcessing,
  diagnostics,
}) => {
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
        <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setPreviewMode('2d')}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
              previewMode === '2d' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            2D 矢量图
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('3d')}
            className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
              previewMode === '3d' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            3D 材质化
          </button>
        </div>
      </div>

      {/* Text Input */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Type className="w-4 h-4" /> 字体选择
          </label>
          <select
            value={selectedFont?.name || ''}
            onChange={(e) => {
              const font = availableFonts.find(f => f.name === e.target.value);
              if (font) setSelectedFont(font);
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-100 focus:border-primary-400 bg-white"
          >
            {availableFonts.map((font) => (
              <option key={font.name} value={font.name}>
                {font.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Type className="w-4 h-4" /> 定制文字
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-primary-100 focus:border-primary-400 min-h-20"
            placeholder="请输入文字..."
          />
        </div>
      </div>

      {/* 3D Extrusion parameters */}
      {previewMode === '3d' && (
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

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700">金属材质 (Material)</label>
            <select
              value={metalMaterial}
              onChange={(e) => setMetalMaterial(e.target.value as 'gold' | 'platinum' | 'rose_gold' | 'silver')}
              className="w-full px-3 py-1.5 text-xs border border-indigo-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-100 focus:outline-none"
            >
              <option value="gold">黄金 (Gold)</option>
              <option value="platinum">白金 (Platinum)</option>
              <option value="rose_gold">玫瑰金 (Rose Gold)</option>
              <option value="silver">纯银 (Silver)</option>
            </select>
          </div>
        </div>
      )}

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
