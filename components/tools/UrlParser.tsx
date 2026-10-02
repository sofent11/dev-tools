import { useDraftState } from './shared/useDraftState';
import { translateUi as tr, useLocaleRender } from '../../src/i18n/render';
import React, { useMemo } from 'react';
import { Copy, Check, Link2, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { FieldLabel, Input } from '../ui/ToolUi';
import { useCopyToClipboard } from './shared/useCopyToClipboard';
import { useI18n } from '../../src/i18n';

export const UrlParser: React.FC = () => {
  useLocaleRender();
  const { t } = useI18n();
  const [input, setInput] = useDraftState('components/tools/UrlParser.tsx:UrlParser:input', 'https://www.example.com:8080/path/to/resource?search=query&id=123#section-2');
  const { copied, copy } = useCopyToClipboard();
  const result = useMemo(() => {
    try {
      const url = new URL(input);
      return { url, parts: [['协议', url.protocol], ['主机', url.hostname], ['端口', url.port || '默认'], ['路径', url.pathname], ['锚点', url.hash || '—'], ['来源', url.origin]], params: Array.from(url.searchParams.entries()) };
    } catch { return null; }
  }, [input]);
  return (
    <Card className="h-full flex flex-col">
      <CardHeader title={tr("URL 解析器")} description={tr("输入地址，即时查看结构、解码参数和重复参数。")} />
      <CardContent className="flex-1 overflow-auto space-y-5">
        <div className="tool-panel p-4 space-y-3">
          <FieldLabel hint={tr("即时解析")}>{tr("完整 URL")}</FieldLabel>
          <Input className="font-mono" value={input} onChange={event => setInput(event.target.value)} placeholder="https://example.com/path?key=value" aria-invalid={!!input && !result} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setInput('https://example.com/products?tag=design&tag=code&page=2#details')}>{tr("重复参数示例")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setInput('')}>{tr("清空")}</Button>
          </div>
        </div>
        {result ? <>
          <div className="tool-panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0"><span className="text-xs text-slate-500">{tr("规范化地址")}</span><p className="mt-1 break-all font-mono text-sm text-slate-900">{result.url.href}</p></div>
            <Button size="sm" variant="secondary" onClick={() => copy(result.url.href)} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{tr("复制 URL")}</Button>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4" />{tr("地址结构")}</h3><dl className="tool-panel divide-y divide-slate-100">{result.parts.map(([label,value]) => <div key={label} className="grid grid-cols-[5rem_1fr] gap-3 p-3"><dt className="text-xs text-slate-500">{tr(label)}</dt><dd className="break-all font-mono text-sm">{value}</dd></div>)}</dl></section>
            <section className="space-y-3"><h3 className="flex items-center gap-2 text-sm font-semibold"><ArrowUpRight className="h-4 w-4" />{tr("查询参数")}<span className="text-xs text-slate-400">{result.params.length}</span></h3>{result.params.length ? <div className="tool-panel overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">{tr("参数名")}</th><th className="p-3">{tr("解码后的值")}</th><th className="p-3"><span className="sr-only">{tr("复制")}</span></th></tr></thead><tbody data-i18n-skip>{result.params.map(([key,value],index) => <tr key={`${key}-${index}`} className="border-t border-slate-100"><td className="p-3 font-mono break-all">{key}</td><td className="p-3 font-mono break-all">{value || '—'}</td><td className="p-3"><button type="button" onClick={() => copy(value)} aria-label={`${t('复制')} ${key}`} className="text-slate-400 hover:text-primary-600"><Copy className="h-4 w-4" /></button></td></tr>)}</tbody></table></div> : <div className="tool-panel p-8 text-sm text-slate-500">{tr("此地址没有查询参数。")}</div>}</section>
          </div>
        </> : <div role={input ? 'alert' : 'status'} className="tool-panel p-8 text-center text-sm text-slate-500">{input ? tr('请输入完整有效的 URL，包含 https:// 或其他协议。') : tr('粘贴一个 URL，结构和参数会在这里展开。')}</div>}
      </CardContent>
    </Card>
  );
};
