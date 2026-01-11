import React from 'react';
import { Type, Settings, Download, Eye, Cpu } from 'lucide-react';

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
  previewMode: 'visual' | 'manufacturing';
  setPreviewMode: (m: 'visual' | 'manufacturing') => void;
  onExport: () => void;
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
  onExport,
  isProcessing,
  diagnostics,
}) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 flex flex-col gap-6 h-full shadow-sm">
      
      {/* Header */}
      <div className="pb-4 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary-600" />
          定制参数
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          调整参数以满足生产制造工艺要求
        </p>
      </div>

      {/* Text Input */}
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
          <p className="text-xs text-slate-400">
            当前实现用 units/mm 把工艺毫米参数映射到画布坐标（用于预览/导出）。
          </p>
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

      {/* View Toggle */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => setPreviewMode('visual')}
          className={`flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all
            ${previewMode === 'visual' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}
          `}
        >
          <Eye className="w-4 h-4" /> 视觉预览
        </button>
        <button
          onClick={() => setPreviewMode('manufacturing')}
          className={`flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all
            ${previewMode === 'manufacturing' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}
          `}
        >
          <Cpu className="w-4 h-4" /> 生产预览
        </button>
      </div>

      {/* Action */}
      <button
        onClick={onExport}
        disabled={isProcessing}
        className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium shadow-sm flex items-center justify-center gap-2 transition-colors"
      >
        {isProcessing ? (
          '计算中...'
        ) : (
          <>
            <Download className="w-4 h-4" /> 导出生产文件
          </>
        )}
      </button>

    </div>
  );
};
