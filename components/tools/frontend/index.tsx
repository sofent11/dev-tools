import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Search } from 'lucide-react';
import { optimize } from 'svgo/browser';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { CodePanel, FieldLabel, Input, TabButton, Tabs, Textarea } from '../../ui/ToolUi';
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

export const SvgOptimizerTool: React.FC = () => {
  const [svg, setSvg] = useState(sampleSvg);
  const [multipass, setMultipass] = useState(true);
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

  const before = byteSize(svg);
  const after = result.data ? byteSize(result.data) : 0;
  const saved = before && after ? Math.max(0, Math.round((1 - after / before) * 100)) : 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="SVG 优化压缩"
        description="本地清理 SVG 注释、冗余属性和尺寸声明，输出更小的 SVG。"
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={multipass} onChange={event => setMultipass(event.target.checked)} />
              multipass
            </label>
            <Button size="sm" variant="secondary" disabled={!result.data} onClick={() => copy(result.data)} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>复制</Button>
            <Button size="sm" variant="secondary" disabled={!result.data} onClick={() => downloadText(result.data, 'optimized.svg')} icon={<Download className="h-4 w-4" />}>下载</Button>
          </>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel hint={`${before} bytes`}>原始 SVG</FieldLabel>
          <Textarea className="min-h-0 flex-1 font-mono text-xs" value={svg} onChange={event => setSvg(event.target.value)} />
        </div>
        <div className="flex min-h-0 flex-col gap-3">
          <div className="grid gap-2 text-sm md:grid-cols-3">
            <div className="tool-panel p-3"><div className="text-xs text-slate-500">Before</div><strong>{before}</strong></div>
            <div className="tool-panel p-3"><div className="text-xs text-slate-500">After</div><strong>{after || '-'}</strong></div>
            <div className="tool-panel p-3"><div className="text-xs text-slate-500">Saved</div><strong>{saved}%</strong></div>
          </div>
          {result.error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{result.error}</div>}
          <CodePanel className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap text-xs">{result.data || '优化结果将在这里显示'}</CodePanel>
          <div className="tool-panel flex min-h-24 items-center justify-center overflow-auto p-4" dangerouslySetInnerHTML={{ __html: result.data || '' }} />
        </div>
      </CardContent>
    </Card>
  );
};
