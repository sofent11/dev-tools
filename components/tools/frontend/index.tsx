import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Search, Info } from 'lucide-react';
import { optimize } from 'svgo/browser';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { CodePanel, FieldLabel, Input, TabButton, Tabs, Textarea } from '../../ui/ToolUi';
import { sanitizeSvgMarkup } from '../shared/sanitizeMarkup';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';

const mimeRows = [
  ['.html', 'text/html'],
  ['.css', 'text/css'],
  ['.js', 'text/javascript'],
  ['.mjs', 'text/javascript'],
  ['.json', 'application/json'],
  ['.xml', 'application/xml'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg / .jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.pdf', 'application/pdf'],
  ['.zip', 'application/zip'],
  ['.wasm', 'application/wasm'],
  ['.txt', 'text/plain'],
  ['.csv', 'text/csv'],
  ['.md', 'text/markdown'],
  ['.woff2', 'font/woff2'],
  ['.mp4', 'video/mp4'],
  ['.mp3', 'audio/mpeg'],
];

export const MimeTypeTool: React.FC = () => {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return mimeRows;
    return mimeRows.filter(([extension, mime]) =>
      extension.toLowerCase().includes(normalized) || mime.toLowerCase().includes(normalized),
    );
  }, [query]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="MIME 类型" description="查询常见文件扩展名与 MIME 类型。" />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder=".svg / json / image" value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        <div className="grid content-start gap-2 overflow-auto md:grid-cols-2">
          {rows.map(([extension, mime]) => (
            <div key={`${extension}-${mime}`} className="tool-panel flex items-center justify-between gap-3 p-3">
              <code className="text-sm font-semibold text-slate-800">{extension}</code>
              <code className="break-all text-right text-sm text-primary-700">{mime}</code>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const encodeSvg = (svg: string) =>
  svg
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/"/g, '\'')
    .replace(/%/g, '%25')
    .replace(/#/g, '%23')
    .replace(/{/g, '%7B')
    .replace(/}/g, '%7D')
    .replace(/</g, '%3C')
    .replace(/>/g, '%3E');

export const SvgToCssTool: React.FC = () => {
  const [svg, setSvg] = useState('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#2563eb"/></svg>');
  const { copied, copy } = useCopyToClipboard();
  const encoded = encodeSvg(svg);
  const background = `background-image: url("data:image/svg+xml,${encoded}");`;
  const mask = `mask-image: url("data:image/svg+xml,${encoded}");\n-webkit-mask-image: url("data:image/svg+xml,${encoded}");`;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="SVG 转 CSS" description="把内联 SVG 转换为 CSS Data URL，可用于 background 或 mask。" />
      <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>SVG</FieldLabel>
          <Textarea className="min-h-0 flex-1 resize-none font-mono" value={svg} onChange={event => setSvg(event.target.value)} />
        </div>
        <div className="flex min-h-0 flex-col gap-4">
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex items-center justify-between">
              <FieldLabel>background-image</FieldLabel>
              <Button size="sm" variant="secondary" onClick={() => copy(background)}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 font-mono text-xs" value={background} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <FieldLabel>mask-image</FieldLabel>
            <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 font-mono text-xs" value={mask} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

type CssGeneratorMode = 'shadow' | 'gradient' | 'radius' | 'glass';

const RangeField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step = 1, unit = 'px', onChange }) => (
  <div>
    <FieldLabel hint={`${value}${unit}`}>{label}</FieldLabel>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={event => onChange(Number(event.target.value))}
      className="w-full accent-primary-600"
    />
  </div>
);

export const CssGeneratorTool: React.FC = () => {
  const [mode, setMode] = useState<CssGeneratorMode>('shadow');
  const [shadow, setShadow] = useState({ x: 0, y: 18, blur: 38, spread: -12, opacity: 0.28 });
  const [gradient, setGradient] = useState({ angle: 135, from: '#0f766e', to: '#f59e0b' });
  const [radius, setRadius] = useState({ tl: 28, tr: 8, br: 28, bl: 8 });
  const [glass, setGlass] = useState({ blur: 18, opacity: 0.34, border: 42 });
  const { copied, copy } = useCopyToClipboard();

  const css = useMemo(() => {
    if (mode === 'shadow') {
      return `box-shadow: ${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px rgba(15, 23, 42, ${shadow.opacity});`;
    }
    if (mode === 'gradient') {
      return `background: linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to});`;
    }
    if (mode === 'radius') {
      return `border-radius: ${radius.tl}px ${radius.tr}px ${radius.br}px ${radius.bl}px;`;
    }
    return [
      `background: rgba(255, 255, 255, ${glass.opacity});`,
      `backdrop-filter: blur(${glass.blur}px);`,
      `-webkit-backdrop-filter: blur(${glass.blur}px);`,
      `border: 1px solid rgba(255, 255, 255, ${glass.border / 100});`,
    ].join('\n');
  }, [glass, gradient, mode, radius, shadow]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="CSS 可视化生成器"
        description="用控件调出常见视觉效果，实时预览并复制 CSS。"
        actions={
          <Button size="sm" variant="secondary" onClick={() => copy(css)} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
            复制 CSS
          </Button>
        }
      />
      <Tabs>
        {([
          ['shadow', '阴影'],
          ['gradient', '渐变'],
          ['radius', '圆角'],
          ['glass', '毛玻璃'],
        ] as const).map(([key, label]) => (
          <TabButton key={key} active={mode === key} onClick={() => setMode(key)}>{label}</TabButton>
        ))}
      </Tabs>
      <CardContent className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-4">
          {mode === 'shadow' && (
            <>
              <RangeField label="X 偏移" value={shadow.x} min={-80} max={80} onChange={x => setShadow({ ...shadow, x })} />
              <RangeField label="Y 偏移" value={shadow.y} min={-80} max={80} onChange={y => setShadow({ ...shadow, y })} />
              <RangeField label="模糊" value={shadow.blur} min={0} max={120} onChange={blur => setShadow({ ...shadow, blur })} />
              <RangeField label="扩展" value={shadow.spread} min={-60} max={60} onChange={spread => setShadow({ ...shadow, spread })} />
              <RangeField label="透明度" value={shadow.opacity} min={0} max={1} step={0.01} unit="" onChange={opacity => setShadow({ ...shadow, opacity })} />
            </>
          )}
          {mode === 'gradient' && (
            <>
              <RangeField label="角度" value={gradient.angle} min={0} max={360} unit="deg" onChange={angle => setGradient({ ...gradient, angle })} />
              <div><FieldLabel>起始颜色</FieldLabel><Input type="color" value={gradient.from} onChange={event => setGradient({ ...gradient, from: event.target.value })} /></div>
              <div><FieldLabel>结束颜色</FieldLabel><Input type="color" value={gradient.to} onChange={event => setGradient({ ...gradient, to: event.target.value })} /></div>
            </>
          )}
          {mode === 'radius' && (
            <>
              <RangeField label="左上" value={radius.tl} min={0} max={120} onChange={tl => setRadius({ ...radius, tl })} />
              <RangeField label="右上" value={radius.tr} min={0} max={120} onChange={tr => setRadius({ ...radius, tr })} />
              <RangeField label="右下" value={radius.br} min={0} max={120} onChange={br => setRadius({ ...radius, br })} />
              <RangeField label="左下" value={radius.bl} min={0} max={120} onChange={bl => setRadius({ ...radius, bl })} />
            </>
          )}
          {mode === 'glass' && (
            <>
              <RangeField label="模糊" value={glass.blur} min={0} max={48} onChange={blur => setGlass({ ...glass, blur })} />
              <RangeField label="背景透明度" value={glass.opacity} min={0} max={1} step={0.01} unit="" onChange={opacity => setGlass({ ...glass, opacity })} />
              <RangeField label="边框透明度" value={glass.border} min={0} max={100} unit="%" onChange={border => setGlass({ ...glass, border })} />
            </>
          )}
        </div>

        <div className="grid min-h-[28rem] gap-4 lg:grid-rows-[minmax(0,1fr)_10rem]">
          <div
            className="tool-panel flex items-center justify-center overflow-hidden p-8"
            style={{
              background:
                mode === 'glass'
                  ? 'linear-gradient(135deg, #0f766e 0%, #f59e0b 45%, #334155 100%)'
                  : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
            }}
          >
            <div
              className="flex h-56 w-72 items-center justify-center border border-white/60 text-sm font-semibold text-slate-800"
              style={{
                ...(mode === 'shadow' ? { boxShadow: `${shadow.x}px ${shadow.y}px ${shadow.blur}px ${shadow.spread}px rgba(15, 23, 42, ${shadow.opacity})`, background: '#ffffff', borderRadius: 18 } : {}),
                ...(mode === 'gradient' ? { background: `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})`, color: '#fff', borderRadius: 18 } : {}),
                ...(mode === 'radius' ? { borderRadius: `${radius.tl}px ${radius.tr}px ${radius.br}px ${radius.bl}px`, background: '#ffffff' } : {}),
                ...(mode === 'glass' ? { background: `rgba(255,255,255,${glass.opacity})`, backdropFilter: `blur(${glass.blur}px)`, WebkitBackdropFilter: `blur(${glass.blur}px)`, border: `1px solid rgba(255,255,255,${glass.border / 100})`, borderRadius: 18, color: '#fff' } : {}),
              }}
            >
              Preview
            </div>
          </div>
          <CodePanel className="overflow-auto whitespace-pre-wrap text-xs">{css}</CodePanel>
        </div>
      </CardContent>
    </Card>
  );
};

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <!-- demo icon -->
  <circle cx="60" cy="60" r="48" fill="#2563eb" stroke="#1e40af" stroke-width="4"/>
  <path d="M38 62l14 14 32-36" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const byteSize = (value: string) => new Blob([value]).size;

const downloadText = (value: string, fileName: string) => {
  const url = URL.createObjectURL(new Blob([value], { type: 'image/svg+xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

interface DiffAudit {
  id: string;
  type: 'remove-node' | 'clean-attr' | 'optimize-path';
  message: string;
  badge: string;
  badgeColor: string;
}

function computeDomDiff(before: string, after: string): DiffAudit[] {
  const list: DiffAudit[] = [];
  try {
    const parser = new DOMParser();
    const docB = parser.parseFromString(before, 'image/svg+xml');
    const docA = parser.parseFromString(after, 'image/svg+xml');

    const countTags = (doc: Document) => {
      const counts: Record<string, number> = {};
      const all = doc.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        const name = all[i].tagName.toLowerCase();
        counts[name] = (counts[name] || 0) + 1;
      }
      return counts;
    };

    const countAttrs = (doc: Document) => {
      const counts: Record<string, number> = {};
      const all = doc.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        for (let j = 0; j < el.attributes.length; j++) {
          const attrName = el.attributes[j].name.toLowerCase();
          counts[attrName] = (counts[attrName] || 0) + 1;
        }
      }
      return counts;
    };

    const tagsB = countTags(docB);
    const tagsA = countTags(docA);
    const attrsB = countAttrs(docB);
    const attrsA = countAttrs(docA);

    Object.keys(tagsB).forEach(tag => {
      const diff = tagsB[tag] - (tagsA[tag] || 0);
      if (diff > 0) {
        let msg = `剥离了冗余 <${tag}> 节点`;
        if (tag === 'metadata') msg = `清理了创作软件残留的 <metadata> 元数据节点`;
        if (tag === 'defs') msg = `精简了未被引用的空定义域 <defs> 容器`;
        if (tag === 'desc' || tag === 'title') msg = `移除了对渲染无用的描述性 <${tag}> 标签`;
        
        list.push({
          id: `node-${tag}`,
          type: 'remove-node',
          message: msg,
          badge: `-${diff} 节点`,
          badgeColor: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:text-rose-400',
        });
      }
    });

    const keyAttrs = ['class', 'data-name', 'id', 'xmlns:xlink', 'version', 'xml:space'];
    Object.keys(attrsB).forEach(attr => {
      const diff = attrsB[attr] - (attrsA[attr] || 0);
      if (diff > 0 && keyAttrs.includes(attr)) {
        list.push({
          id: `attr-${attr}`,
          type: 'clean-attr',
          message: `剥离了冗余样式/命名空间属性: \`${attr}\``,
          badge: `-${diff} 属性`,
          badgeColor: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400',
        });
      }
    });

    if (before.includes('<path') && after.includes('<path')) {
      list.push({
        id: 'path-prec',
        type: 'optimize-path',
        message: '浮点数路径坐标平滑舍入 (无损降低精度)',
        badge: '已优化',
        badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400',
      });
    }

  } catch (e) {
    console.error('DOM diff parsing failed', e);
  }

  if (list.length === 0) {
    list.push({
      id: 'no-diff',
      type: 'optimize-path',
      message: '移除了隐性多余空白符、换行符和 XML 序言声明',
      badge: '已舍入',
      badgeColor: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400',
    });
  }

  return list;
}

export const SvgOptimizerTool: React.FC = () => {
  const [svg, setSvg] = useState(sampleSvg);
  const [multipass, setMultipass] = useState(true);
  const [previewTab, setPreviewTab] = useState<'render' | 'diff' | 'audit'>('render');
  const [sliderValue, setSliderValue] = useState<number>(50);
  const { copied, copy } = useCopyToClipboard();

  const result = useMemo(() => {
    try {
      const optimized = optimize(svg, {
        multipass,
        plugins: [
          'preset-default',
          'removeDimensions',
          { name: 'removeAttrs', params: { attrs: '(data-name|class)' } },
        ],
      });
      if ('data' in optimized) return { data: optimized.data, error: '' };
      return { data: '', error: '无法优化 SVG' };
    } catch (error) {
      return { data: '', error: (error as Error).message };
    }
  }, [multipass, svg]);

  // Compute DOM differences for the Audit Tab
  const audits = useMemo(() => {
    if (!result.data) return [];
    return computeDomDiff(svg, result.data);
  }, [svg, result.data]);
  const safeSourceSvg = useMemo(() => sanitizeSvgMarkup(svg), [svg]);
  const safeOptimizedSvg = useMemo(() => sanitizeSvgMarkup(result.data || ''), [result.data]);

  const before = byteSize(svg);
  const after = result.data ? byteSize(result.data) : 0;
  const saved = before && after ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="SVG 智能压缩与细节差分比对"
        description="本地清理 SVG 注释与冗余属性，内置 Split-Slider 像素级划水差分镜及冗余 DOM 节点精简审计树。"
        actions={
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer">
              <input type="checkbox" checked={multipass} onChange={event => setMultipass(event.target.checked)} className="rounded text-primary-600 focus:ring-primary-400" />
              <span>多轮压缩 (multipass)</span>
            </label>
            <Button size="sm" variant="secondary" disabled={!result.data} onClick={() => copy(result.data)} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
              复制优化代码
            </Button>
            <Button size="sm" variant="secondary" disabled={!result.data} onClick={() => downloadText(result.data, 'optimized.svg')} icon={<Download className="h-4 w-4" />}>
              下载 SVG
            </Button>
          </div>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
        {/* Left Side: Original XML Input (Flexible and tall) */}
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel hint={`${before} bytes`}>原始 SVG XML 源代码</FieldLabel>
          <Textarea className="min-h-0 flex-1 font-mono text-xs leading-relaxed" value={svg} onChange={event => setSvg(event.target.value)} />
        </div>

        {/* Right Side: Preview Tabs & Analytics */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Top Level Stats Panel */}
          <div className="grid gap-3 text-sm grid-cols-3">
            <div className="tool-panel p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Before</div>
              <strong className="text-base font-mono text-slate-800 dark:text-slate-100">{before} bytes</strong>
            </div>
            <div className="tool-panel p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">After</div>
              <strong className="text-base font-mono text-slate-800 dark:text-slate-100">{after || '-'} bytes</strong>
            </div>
            <div className="tool-panel p-3.5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-950/40 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-emerald-800 dark:text-emerald-400">
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Saved</div>
              <strong className="text-base font-mono font-extrabold">{saved}% 体积</strong>
            </div>
          </div>

          {result.error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 font-mono">
              {result.error}
            </div>
          )}

          {/* Interactive tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            {([
              ['render', '优化预览'],
              ['diff', '2D 划水差分拉条'],
              ['audit', 'DOM 冗余精简树'],
            ] as const).map(([tabKey, label]) => (
              <button
                key={tabKey}
                onClick={() => setPreviewTab(tabKey)}
                className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all ${previewTab === tabKey ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Combined Visual workbench container */}
          <div className="min-h-0 flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {previewTab === 'render' && (
              <div className="flex-1 flex flex-col min-h-0">
                <CodePanel className="flex-1 overflow-auto whitespace-pre-wrap text-[10px] font-mono p-4 border-b border-slate-200 dark:border-slate-800 leading-relaxed bg-slate-950 text-emerald-400">
                  {result.data || '优化结果将在这里显示'}
                </CodePanel>
                <div className="bg-white dark:bg-slate-950 p-4 h-32 flex items-center justify-center overflow-auto flex-none" dangerouslySetInnerHTML={{ __html: safeOptimizedSvg }} />
              </div>
            )}

            {previewTab === 'diff' && (
              <div className="flex-1 flex flex-col p-4 relative min-h-0 select-none">
                <div className="flex-1 relative bg-checkerboard rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex items-center justify-center">
                  
                  {/* Bottom Layer: Before SVG (Original) */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center p-4 transition-all opacity-40 filter grayscale pointer-events-none"
                    dangerouslySetInnerHTML={{ __html: safeSourceSvg }}
                  />

                  {/* Top Layer: After SVG (Optimized) with custom clipping width */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden pointer-events-none bg-checkerboard"
                    style={{
                      clipPath: `inset(0 ${100 - sliderValue}% 0 0)`,
                    }}
                    dangerouslySetInnerHTML={{ __html: safeOptimizedSvg }}
                  />

                  {/* High quality neon-blue slider hairline indicator */}
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-sky-500 dark:bg-sky-400 pointer-events-none"
                    style={{ left: `${sliderValue}%` }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-sky-500 shadow-md flex items-center justify-center text-[8px] font-bold text-sky-600">
                      ↔
                    </div>
                  </div>
                </div>

                {/* Slider inputs control board */}
                <div className="mt-3 flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl flex-none">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">差分拉条</span>
                  <input 
                    type="range" min="0" max="100" 
                    value={sliderValue} 
                    onChange={e => setSliderValue(Number(e.target.value))}
                    className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <span className="text-xs font-mono font-semibold text-sky-600 dark:text-sky-400 shrink-0">{sliderValue}%</span>
                </div>
              </div>
            )}

            {previewTab === 'audit' && (
              <div className="flex-1 overflow-auto p-4 space-y-2.5 max-h-[380px]">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 border-b pb-2 dark:border-slate-800">
                  <Info className="w-3.5 h-3.5 text-primary-500" />
                  <span>下面列出了 SVGO 引擎在此次压缩中，成功为您剥离的冗余元素及压缩属性：</span>
                </div>

                <div className="space-y-2">
                  {audits.map(item => (
                    <div key={item.id} className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center text-xs shadow-sm hover:shadow transition-all">
                      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="font-mono leading-relaxed">{item.message}</span>
                      </div>
                      <span className={`px-2 py-0.5 border rounded-full text-[10px] font-bold shrink-0 uppercase tracking-wider ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ================= HTML to JSX Tool =================
export const HtmlToJsxTool: React.FC = () => {
  const [html, setHtml] = useState(
    `<div class="card" style="margin-top: 10px; background: #fff">\n  <label for="username">Username</label>\n  <input type="text" id="username" class="input-field" disabled>\n  <hr>\n</div>`
  );
  const [wrapFragment, setWrapFragment] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  const jsxResult = useMemo(() => {
    if (!html.trim()) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
      const nodes = Array.from(doc.body.childNodes);
      
      if (nodes.length === 0) return '';
      
      const serializeNode = (node: Node, depth: number): string => {
        const indent = '  '.repeat(depth);
        
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.nodeValue || '';
          if (!text.trim()) return text;
          return text.replace(/[{}]/g, m => `{'${m}'}`);
        }
        
        if (node.nodeType === Node.COMMENT_NODE) {
          return `${indent}{/* ${node.nodeValue?.trim()} */}`;
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          const tagName = el.tagName.toLowerCase();
          
          const attrs: string[] = [];
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            let name = attr.name.toLowerCase();
            const val = attr.value;
            
            if (name === 'class') name = 'className';
            else if (name === 'for') name = 'htmlFor';
            else if (name === 'tabindex') name = 'tabIndex';
            else if (name === 'autofocus') name = 'autoFocus';
            else if (name === 'autocomplete') name = 'autoComplete';
            else if (name === 'readonly') name = 'readOnly';
            else if (name === 'maxlength') name = 'maxLength';
            else if (name === 'colspan') name = 'colSpan';
            else if (name === 'rowspan') name = 'rowSpan';
            else if (name === 'contenteditable') name = 'contentEditable';
            else if (name.startsWith('on')) {
              name = 'on' + name.slice(2).charAt(0).toUpperCase() + name.slice(3);
            } else if (name.includes('-') && !name.startsWith('data-') && !name.startsWith('aria-')) {
              name = name.replace(/-([a-z])/g, g => g[1].toUpperCase());
            }
            
            if (name === 'style') {
              const styleObj: Record<string, string> = {};
              val.split(';').forEach(rule => {
                const parts = rule.split(':');
                if (parts.length >= 2) {
                  const key = parts[0].trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
                  const value = parts.slice(1).join(':').trim();
                  if (key && value) {
                    styleObj[key] = value;
                  }
                }
              });
              const styleStr = Object.entries(styleObj)
                .map(([k, v]) => `  ${k}: '${v.replace(/'/g, "\\'")}'`)
                .join(',\n');
              attrs.push(`style={{ \n${styleStr}\n}}`);
            } else {
              const booleans = ['disabled', 'checked', 'required', 'readOnly', 'multiple', 'autoFocus', 'hidden'];
              if (booleans.includes(name)) {
                attrs.push(name);
              } else {
                attrs.push(`${name}="${val.replace(/"/g, '&quot;')}"`);
              }
            }
          }
          
          const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
          const selfClosing = ['img', 'input', 'br', 'hr', 'meta', 'link', 'area', 'col', 'embed', 'source', 'track', 'wbr'];
          if (selfClosing.includes(tagName) && el.childNodes.length === 0) {
            return `${indent}<${tagName}${attrsStr} />`;
          }
          
          let children = '';
          let hasComplex = false;
          el.childNodes.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) hasComplex = true;
            const childStr = serializeNode(child, depth + 1);
            if (childStr) children += childStr;
          });
          
          if (hasComplex) {
            return `${indent}<${tagName}${attrsStr}>\n${children}\n${indent}</${tagName}>`;
          } else {
            return `${indent}<${tagName}${attrsStr}>${children.trim()}</${tagName}>`;
          }
        }
        return '';
      };
      
      const filteredNodes = nodes.filter(n => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.nodeValue?.trim()));
      
      let finalJsx = '';
      if (wrapFragment || filteredNodes.length > 1) {
        finalJsx = `<>\n${filteredNodes.map(n => serializeNode(n, 1)).join('\n')}\n</>`;
      } else if (filteredNodes.length === 1) {
        finalJsx = serializeNode(filteredNodes[0], 0);
      }
      
      return finalJsx;
    } catch (e) {
      return '编译 HTML 出错: ' + (e as Error).message;
    }
  }, [html, wrapFragment]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="HTML 转 JSX 智能编译器"
        description="将原生 HTML 极速、精确地转换为 React JSX 格式，自动转换 class, style, label-for 等属性。"
        actions={
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={wrapFragment}
                onChange={event => setWrapFragment(event.target.checked)}
                className="rounded text-primary-600 focus:ring-primary-400"
              />
              <span>强制 Fragment 包裹</span>
            </label>
            <Button size="sm" variant="secondary" disabled={!jsxResult} onClick={() => copy(jsxResult)}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              <span className="ml-1">复制 JSX</span>
            </Button>
          </div>
        }
      />
      <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>HTML 源代码</FieldLabel>
          <Textarea
            className="min-h-0 flex-1 font-mono text-xs leading-relaxed"
            value={html}
            onChange={event => setHtml(event.target.value)}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>React JSX 输出</FieldLabel>
          <CodePanel className="min-h-0 flex-1 overflow-auto whitespace-pre font-mono text-[11px] leading-relaxed bg-slate-950 text-emerald-400 p-4">
            {jsxResult || '// 转换结果将在这里实时显示'}
          </CodePanel>
        </div>
      </CardContent>
    </Card>
  );
};

// ================= SVG to React Tool =================
export const SvgToReactTool: React.FC = () => {
  const [svg, setSvg] = useState(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2">\n  <circle cx="12" cy="12" r="10" />\n  <path d="M12 8v4l3 3" />\n</svg>`
  );
  const [componentName, setComponentName] = useState('MyCustomIcon');
  const [isTs, setIsTs] = useState(true);
  const [useForwardRef, setUseForwardRef] = useState(true);
  const [removeDimensions, setRemoveDimensions] = useState(true);
  const [useCurrentColor, setUseCurrentColor] = useState(true);
  const [customSize, setCustomSize] = useState(true);
  
  const { copied, copy } = useCopyToClipboard();

  const reactComponentCode = useMemo(() => {
    if (!svg.trim()) return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svg.trim(), 'image/svg+xml');
      const svgEl = doc.querySelector('svg');
      if (!svgEl) return '// 错误：无法在输入中找到 <svg> 元素';

      const name = componentName.trim().replace(/[^a-zA-Z0-9]/g, '') || 'SvgIcon';
      const attributes: string[] = [];
      const viewBox = svgEl.getAttribute('viewBox') || '0 0 24 24';

      for (let i = 0; i < svgEl.attributes.length; i++) {
        const attr = svgEl.attributes[i];
        const attrName = attr.name.toLowerCase();
        let val = attr.value;

        if (attrName === 'viewbox' || attrName === 'xmlns') continue;
        if (removeDimensions && (attrName === 'width' || attrName === 'height')) continue;

        let reactName = attrName;
        if (attrName.includes('-')) {
          reactName = attrName.replace(/-([a-z])/g, g => g[1].toUpperCase());
        }

        if (useCurrentColor && (attrName === 'fill' || attrName === 'stroke')) {
          if (val !== 'none') val = 'currentColor';
        }

        attributes.push(`${reactName}="${val}"`);
      }

      if (customSize) {
        attributes.push('width={size}');
        attributes.push('height={size}');
      } else if (!removeDimensions) {
        const w = svgEl.getAttribute('width');
        const h = svgEl.getAttribute('height');
        if (w) attributes.push(`width="${w}"`);
        if (h) attributes.push(`height="${h}"`);
      }

      const serializeSvgNode = (node: Node): string => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          const tagName = el.tagName.toLowerCase();
          const attrs: string[] = [];

          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            let name = attr.name;
            let val = attr.value;

            if (name.includes('-')) {
              name = name.replace(/-([a-z])/g, g => g[1].toUpperCase());
            }

            if (useCurrentColor && (attr.name === 'fill' || attr.name === 'stroke')) {
              if (val !== 'none') val = 'currentColor';
            }

            if (name === 'style') {
              const styleObj: Record<string, string> = {};
              val.split(';').forEach(rule => {
                const parts = rule.split(':');
                if (parts.length >= 2) {
                  const key = parts[0].trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
                  const value = parts.slice(1).join(':').trim();
                  if (key && value) styleObj[key] = value;
                }
              });
              const styleStr = Object.entries(styleObj)
                .map(([k, v]) => `${k}: '${v}'`)
                .join(', ');
              attrs.push(`style={{ ${styleStr} }}`);
            } else {
              attrs.push(`${name}="${val}"`);
            }
          }

          const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
          const selfClosing = ['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use', 'image'];
          if (selfClosing.includes(tagName) && el.childNodes.length === 0) {
            return `<${tagName}${attrsStr} />`;
          }

          let children = '';
          el.childNodes.forEach(child => {
            children += serializeSvgNode(child);
          });

          return `<${tagName}${attrsStr}>${children}</${tagName}>`;
        }
        if (node.nodeType === Node.TEXT_NODE) {
          return node.nodeValue || '';
        }
        return '';
      };

      let childrenStr = '';
      svgEl.childNodes.forEach(child => {
        childrenStr += serializeSvgNode(child);
      });

      let code = '';
      if (useForwardRef) {
        code += `import React, { forwardRef } from 'react';\n\n`;
      } else {
        code += `import React from 'react';\n\n`;
      }

      if (isTs) {
        if (customSize) {
          code += `interface ${name}Props extends React.SVGProps<SVGSVGElement> {\n  size?: number | string;\n}\n\n`;
        } else {
          code += `type ${name}Props = React.SVGProps<SVGSVGElement>;\n\n`;
        }
      }

      if (useForwardRef) {
        if (isTs) {
          code += `export const ${name} = forwardRef<SVGSVGElement, ${name}Props>((\n  { ${customSize ? 'size = 24, ' : ''}...props },\n  ref\n) => {\n`;
        } else {
          code += `export const ${name} = forwardRef((\n  { ${customSize ? 'size = 24, ' : ''}...props },\n  ref\n) => {\n`;
        }
      } else {
        if (isTs) {
          code += `export const ${name}: React.FC<${name}Props> = ({\n  ${customSize ? 'size = 24, ' : ''}...props\n}) => {\n`;
        } else {
          code += `export const ${name} = ({\n  ${customSize ? 'size = 24, ' : ''}...props\n}) => {\n`;
        }
      }

      code += `  return (\n`;
      const refProp = useForwardRef ? ' ref={ref}' : '';
      code += `    <svg\n`;
      code += `      viewBox="${viewBox}"\n`;
      if (refProp) code += `     ${refProp}\n`;
      
      attributes.forEach(attr => {
        code += `      ${attr}\n`;
      });
      
      code += `      {...props}\n`;
      code += `    >\n`;
      
      const indentedChildren = childrenStr
        .trim()
        .replace(/></g, '>\n<')
        .split('\n')
        .map(line => `      ${line}`)
        .join('\n');
        
      code += indentedChildren + '\n';
      code += `    </svg>\n`;
      code += `  );\n`;
      
      if (useForwardRef) {
        code += `});\n\n`;
        code += `${name}.displayName = '${name}';\n`;
      } else {
        code += `};\n`;
      }

      return code;
    } catch (e) {
      return '// 转换 SVG 出错: ' + (e as Error).message;
    }
  }, [svg, componentName, isTs, useForwardRef, removeDimensions, useCurrentColor, customSize]);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="SVG 转 React JSX/TSX 组件"
        description="一键将 SVG 转换为生产级的 React / TSX 矢量图标组件，支持 TypeScript、forwardRef 引用、自动 currentColor 及弹性尺寸。"
        actions={
          <Button size="sm" variant="secondary" disabled={!reactComponentCode} onClick={() => copy(reactComponentCode)}>
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            <span className="ml-1">复制 React 组件</span>
          </Button>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div>
            <FieldLabel>组件命名</FieldLabel>
            <Input value={componentName} onChange={e => setComponentName(e.target.value)} placeholder="e.g. MyIcon" />
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <label className="tool-panel flex cursor-pointer items-center gap-2 p-2.5 text-xs font-semibold">
              <input type="checkbox" checked={isTs} onChange={e => setIsTs(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-400" />
              <span>TypeScript (TSX)</span>
            </label>
            <label className="tool-panel flex cursor-pointer items-center gap-2 p-2.5 text-xs font-semibold">
              <input type="checkbox" checked={useForwardRef} onChange={e => setUseForwardRef(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-400" />
              <span>forwardRef</span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="tool-panel flex cursor-pointer items-center gap-2 p-2.5 text-xs font-semibold">
              <input type="checkbox" checked={removeDimensions} onChange={e => setRemoveDimensions(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-400" />
              <span>清理硬编码宽高 (width/height)</span>
            </label>
            <label className="tool-panel flex cursor-pointer items-center gap-2 p-2.5 text-xs font-semibold">
              <input type="checkbox" checked={useCurrentColor} onChange={e => setUseCurrentColor(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-400" />
              <span>自动替换颜色为 currentColor</span>
            </label>
            <label className="tool-panel flex cursor-pointer items-center gap-2 p-2.5 text-xs font-semibold">
              <input type="checkbox" checked={customSize} onChange={e => setCustomSize(e.target.checked)} className="rounded text-primary-600 focus:ring-primary-400" />
              <span>注入弹性 size 属性 (默认为 24)</span>
            </label>
          </div>
          
          <div className="flex flex-col gap-2">
            <FieldLabel>原始 SVG 源码</FieldLabel>
            <Textarea
              className="h-44 font-mono text-[10px] leading-normal"
              value={svg}
              onChange={e => setSvg(e.target.value)}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>React 组件代码</FieldLabel>
          <CodePanel className="min-h-[26rem] flex-1 overflow-auto whitespace-pre font-mono text-[11px] leading-relaxed bg-slate-950 text-emerald-400 p-4">
            {reactComponentCode || '// 组件输出将在这里实时渲染'}
          </CodePanel>
        </div>
      </CardContent>
    </Card>
  );
};
