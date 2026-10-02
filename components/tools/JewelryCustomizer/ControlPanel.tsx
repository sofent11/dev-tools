import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import React, { useState, useEffect } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { Button } from '../../ui/Button';

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

  onReset: () => void;

  availableFonts: Array<{ name: string; url: string }>;
  selectedFont: { name: string; url: string } | null;
  setSelectedFont: (font: { name: string; url: string }) => void;
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
  
  extrusionThicknessMm, setExtrusionThicknessMm,
  metalMaterial, setMetalMaterial,

  loopType, setLoopType,
  loopOuterDiameterMm, setLoopOuterDiameterMm,
  loopInnerDiameterMm, setLoopInnerDiameterMm,
  frameStyle, setFrameStyle,
  framePaddingMm, setFramePaddingMm,
  frameMaterial, setFrameMaterial,
  
  onReset,

  availableFonts,
  selectedFont,
  setSelectedFont,
  diagnostics,
}) => {
  useLocaleRender();
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

  const presets = [
    { name: '文字贴片', frame: 'none' as const, loop: 'none' as const },
    { name: '单孔吊坠', frame: 'contour' as const, loop: 'top' as const },
    { name: '双耳项链', frame: 'none' as const, loop: 'double_side' as const },
  ];
  return (
    <div className="tool-section flex min-w-0 flex-col gap-5 p-4">
      <div className="space-y-2">
        <label htmlFor="jewelry-text" className="text-sm font-semibold text-slate-800">{tr("01 · 定制文字")}</label>
        <textarea id="jewelry-text" maxLength={80} value={text} onChange={event => setText(event.target.value)} className="min-h-20 w-full resize-y rounded-lg border p-3 text-lg" placeholder={tr("输入名字或短句")} />
        <p className="text-xs text-slate-500">{tr("最多 80 个字符；短文字更容易保持整体连通，字体需覆盖输入字符。")}</p>
      </div>
      <div className="space-y-3">
        <label htmlFor="jewelry-font" className="text-sm font-semibold text-slate-800">{tr("02 · 选择字体")}</label>
        <select id="jewelry-font" value={selectedFont?.url || ''} onChange={event => { const font = availableFonts.find(item => item.url === event.target.value); if (font) setSelectedFont(font); }} className="w-full rounded-lg border bg-white p-3 text-sm">{availableFonts.map(font => <option key={font.url} value={font.url}>{tr(font.name)}</option>)}</select>
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-500">{tr("浏览字体效果 ·")}{availableFonts.length}</summary>
          <div className="mt-3 flex flex-wrap gap-1">{[{ id: 'all' as const, label: tr('全部') }, { id: 'elegant' as const, label: tr('高雅') }, { id: 'script' as const, label: tr('手写') }, { id: 'cute' as const, label: tr('卡通') }, { id: 'modern' as const, label: tr('现代') }].map(category => <Button key={category.id} size="xs" variant={activeCategory === category.id ? 'primary' : 'ghost'} onClick={() => setActiveCategory(category.id)}>{category.label}</Button>)}</div>
          <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-auto">{filteredFonts.map(font => <button key={font.url} type="button" aria-pressed={selectedFont?.url === font.url} onClick={() => setSelectedFont(font)} className={`relative min-w-0 rounded-lg border p-3 text-center ${selectedFont?.url === font.url ? 'border-primary-600 bg-primary-50' : 'border-slate-200 bg-white'}`}>
            {selectedFont?.url === font.url && <Check className="absolute right-1 top-1 h-3 w-3 text-primary-600" />}
            <span className="block truncate text-xl" style={{ fontFamily: `'${font.name}'` }}>{text.slice(0, 6) || 'Aa'}</span><span className="mt-2 block truncate text-[10px] text-slate-500">{font.name.replace(' (自动加固)', '')}</span>
          </button>)}</div>
        </details>
      </div>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-800">{tr("03 · 首饰版型")}</h3>
        <div className="grid grid-cols-3 gap-2">{presets.map(preset => <Button key={preset.name} size="sm" variant={frameStyle === preset.frame && loopType === preset.loop ? 'primary' : 'secondary'} className="h-auto min-h-9 whitespace-normal px-1 py-2 text-center leading-4" aria-pressed={frameStyle === preset.frame && loopType === preset.loop} onClick={() => { setFrameStyle(preset.frame); setLoopType(preset.loop); setLoopOuterDiameterMm(4); setLoopInnerDiameterMm(2); setFramePaddingMm(2); }}>{tr(preset.name)}</Button>)}</div>
      </div>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">{tr("字形与尺寸")}</summary>
        <div className="mt-4 space-y-4"><RangeControl label={tr("字号")} value={fontSize} onChange={setFontSize} min={20} max={200} step={1} unit="px" /><RangeControl label={tr("线条增粗")} value={offsetMm} onChange={setOffsetMm} min={0} max={2} step={0.05} unit="mm" /><RangeControl label={tr("字距")} value={letterSpacingMm} onChange={setLetterSpacingMm} min={-2} max={4} step={0.05} unit="mm" /></div>
      </details>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">{tr("底框与挂耳")}</summary>
        <div className="mt-4 space-y-4">
          <label className="flex flex-col gap-2 text-xs font-medium">{tr("底框样式")}<select className="rounded-lg border p-2 text-sm" value={frameStyle} onChange={event => setFrameStyle(event.target.value as typeof frameStyle)}><option value="none">{tr("无底框")}</option><option value="contour">{tr("气泡轮廓")}</option><option value="bar">{tr("圆角横条")}</option><option value="oval">{tr("椭圆底板")}</option><option value="heart">{tr("爱心底板")}</option></select></label>
          {frameStyle !== 'none' && <RangeControl label={tr("底板留边")} value={framePaddingMm} onChange={setFramePaddingMm} min={1} max={5} step={0.5} unit="mm" />}
          <label className="flex flex-col gap-2 text-xs font-medium">{tr("挂耳方式")}<select className="rounded-lg border p-2 text-sm" value={loopType} onChange={event => setLoopType(event.target.value as typeof loopType)}><option value="none">{tr("无挂耳")}</option><option value="top">{tr("顶部单孔")}</option><option value="double_side">{tr("左右双耳")}</option><option value="double_top">{tr("顶部双耳")}</option></select></label>
          {loopType !== 'none' && <><RangeControl label={tr("挂耳外径")} value={loopOuterDiameterMm} onChange={value => { setLoopOuterDiameterMm(value); if (loopInnerDiameterMm >= value) setLoopInnerDiameterMm(Math.max(1, value - 0.5)); }} min={2} max={6} step={0.1} unit="mm" /><RangeControl label={tr("挂耳内径")} value={loopInnerDiameterMm} onChange={setLoopInnerDiameterMm} min={1} max={Math.min(4, loopOuterDiameterMm - 0.2)} step={0.1} unit="mm" /></>}
        </div>
      </details>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">{tr("厚度与金属外观")}</summary>
        <div className="mt-4 space-y-4"><RangeControl label={tr("挤出厚度")} value={extrusionThicknessMm} onChange={setExtrusionThicknessMm} min={0.5} max={8} step={0.1} unit="mm" /><MaterialSelect label={tr("文字材质")} value={metalMaterial} onChange={setMetalMaterial} /><MaterialSelect label={tr("底框材质")} value={frameMaterial} onChange={setFrameMaterial} disabled={frameStyle === 'none'} /><p className="text-xs text-slate-500">{tr("材质仅影响预览；倒角和底框会增加整体厚度，打印前复检尺寸。")}</p></div>
      </details>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">{tr("制造与连通参数 · 高级")}</summary>
        <div className="mt-4 space-y-4"><RangeControl label={tr("最小连桥宽度")} value={minBridgeMm} onChange={setMinBridgeMm} min={0.3} max={3} step={0.05} unit="mm" /><RangeControl label={tr("桥接最大间隙")} value={bridgeMaxGapMm} onChange={setBridgeMaxGapMm} min={0} max={20} step={0.1} unit="mm" /><RangeControl label={tr("扁平化误差")} value={flattenToleranceMm} onChange={setFlattenToleranceMm} min={0.02} max={0.5} step={0.01} unit="mm" /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={autoTighten} onChange={event => setAutoTighten(event.target.checked)} />{tr("自动压缩字距以连通")}</label><RangeControl label={tr("最大字距压缩量")} value={autoTightenMaxMm} onChange={setAutoTightenMaxMm} min={0} max={5} step={0.1} unit="mm" disabled={!autoTighten} /><RangeControl label={tr("单位换算")} value={unitsPerMm} onChange={setUnitsPerMm} min={1} max={20} step={0.01} unit="units/mm" /></div>
      </details>
      {diagnostics && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-xs font-medium text-slate-500">{tr("几何诊断 ·")}{diagnostics.componentsAfterRepair}{tr("个连通分量")}</summary><dl className="mt-3 space-y-2 text-xs text-slate-500"><div className="flex justify-between"><dt>{tr("连通分量")}</dt><dd>{diagnostics.componentsBeforeRepair} → {diagnostics.componentsAfterRepair}</dd></div><div className="flex justify-between"><dt>{tr("应用字距")}</dt><dd>{diagnostics.appliedLetterSpacingMm.toFixed(2)} mm</dd></div><div className="flex justify-between"><dt>{tr("桥接数量")}</dt><dd>{diagnostics.usedBridgeCount}</dd></div></dl></details>}
      <Button size="sm" variant="ghost" className="self-start" onClick={onReset} icon={<RotateCcw className="h-3.5 w-3.5" />}>{tr("恢复默认参数")}</Button>
    </div>
  );
};

const RangeControl: React.FC<{ label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number; unit: string; disabled?: boolean }> = ({ label, value, onChange, min, max, step, unit, disabled }) => {
  useLocaleRender();
  const id = React.useId();
  return <div className="space-y-2"><div className="flex items-center justify-between gap-2"><label htmlFor={id} className="text-xs font-medium text-slate-700">{label}</label><span className="font-mono text-xs text-slate-500">{value} {unit}</span></div><input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} className="w-full accent-primary-600 disabled:opacity-40" /></div>;
};

const MaterialSelect: React.FC<{ label: string; value: ControlPanelProps['metalMaterial']; onChange: (value: ControlPanelProps['metalMaterial']) => void; disabled?: boolean }> = ({ label, value, onChange, disabled }) => { useLocaleRender(); return ((
  <label className="flex flex-col gap-2 text-xs font-medium">{label}<select className="rounded-lg border p-2 text-sm" value={value} onChange={event => onChange(event.target.value as ControlPanelProps['metalMaterial'])} disabled={disabled}><option value="gold">{tr("黄金")}</option><option value="platinum">{tr("白金")}</option><option value="rose_gold">{tr("玫瑰金")}</option><option value="silver">{tr("纯银")}</option></select></label>
)); };
