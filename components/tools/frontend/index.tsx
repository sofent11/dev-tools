import React, { useMemo, useState } from 'react';
import { Check, Copy, Search } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Textarea } from '../../ui/ToolUi';
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
