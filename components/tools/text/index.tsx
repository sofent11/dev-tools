import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import { formatHtml, minifyHtml } from './htmlCore';
import { toRmbUppercase } from './contentCore';
import { useDraftState } from '../shared/useDraftState';
import React, { useMemo, useState } from 'react';
import TurndownService from 'turndown';
import { ArrowRightLeft, FileCode, Minimize2 } from 'lucide-react';
import { Card, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';
import { ContentEditor, ContentToolbar, ContentOptions } from '../shared/ContentWorkflow';

const sampleHtml = '<article><h1>Hello</h1><p>Paste HTML here.</p><ul><li>Local only</li></ul></article>';

export const HtmlToMarkdownTool: React.FC = () => {
  useLocaleRender();
  const [input, setInput] = useDraftState('components/tools/text/index.tsx:HtmlToMarkdownTool:input', '');
  const [heading, setHeading] = useState<'atx' | 'setext'>('atx');
  const [codeStyle, setCodeStyle] = useState<'fenced' | 'indented'>('fenced');
  const result = useMemo(() => {
    try {
      const service = new TurndownService({ codeBlockStyle: codeStyle, headingStyle: heading, bulletListMarker: '-' });
      return { output: input.trim() ? service.turndown(input) : '', error: '' };
    } catch (error) { return { output: '', error: error instanceof Error ? error.message : 'HTML 处理失败' }; }
  }, [codeStyle, heading, input]);
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => setInput(sampleHtml)} onClear={() => setInput('')} status="实时转换" />
    <ContentOptions title={tr("Markdown 输出选项")}><label className="flex items-center gap-2 text-sm">{tr("标题格式")}<select aria-label={tr("标题格式")} className="rounded border p-2" value={heading} onChange={event => setHeading(event.target.value as typeof heading)}><option value="atx">{tr("# 标题")}</option><option value="setext">{tr("下划线标题")}</option></select></label><label className="flex items-center gap-2 text-sm">{tr("代码块")}<select aria-label={tr("代码块")} className="rounded border p-2" value={codeStyle} onChange={event => setCodeStyle(event.target.value as typeof codeStyle)}><option value="fenced">{tr("围栏代码块")}</option><option value="indented">{tr("缩进代码块")}</option></select></label></ContentOptions>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("HTML 输入")} value={input} onChange={setInput} error={result.error} placeholder={tr("粘贴 HTML 片段，转换后的 Markdown 即时显示。")} /><ContentEditor label={tr("Markdown 输出")} value={result.output} output placeholder={tr("转换结果会保留标题、列表、链接与代码结构。")} /></div>
  </CardContent></Card>;
};

export const HtmlFormatTool: React.FC = () => {
  useLocaleRender();
  const [input, setInput] = useDraftState('components/tools/text/index.tsx:HtmlFormatTool:input', '');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const updateInput = (value: string) => { setInput(value); setOutput(''); setError(''); };
  const run = (mode: 'format' | 'minify') => {
    try { setOutput(mode === 'format' ? formatHtml(input) : minifyHtml(input)); setError(''); }
    catch (event) { setOutput(''); setError(event instanceof Error ? event.message : 'HTML 处理失败'); }
  };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput(sampleHtml)} onClear={() => updateInput('')}><Button icon={<FileCode className="h-4 w-4" />} onClick={() => run('format')} disabled={!input.trim()}>{tr("格式化")}</Button><Button variant="secondary" icon={<Minimize2 className="h-4 w-4" />} onClick={() => run('minify')} disabled={!input.trim()}>{tr("压缩")}</Button></ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("HTML 输入")} value={input} onChange={updateInput} error={error} placeholder={tr("粘贴 HTML，原始输入会保留。")} /><ContentEditor label={tr("HTML 输出")} value={output} output placeholder={tr("格式化或压缩后查看结果。")} onUseResult={() => updateInput(output)} /></div>
    <p className="text-xs text-slate-500">{tr("仅整理块级结构的缩进，保留行内文本、注释和 pre、script、style、textarea 中的空白。")}</p>
  </CardContent></Card>;
};

export const RmbUppercaseTool: React.FC = () => {
  useLocaleRender();
  const [input, setInput] = useDraftState('components/tools/text/index.tsx:RmbUppercaseTool:input', '123456.78');
  const { copied, copy } = useCopyToClipboard();
  const output = useMemo(() => input.trim() ? toRmbUppercase(input) : '', [input]);

  return (
    <Card className="h-full flex flex-col">

      <CardContent className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 overflow-auto">
        <ContentToolbar onSample={() => setInput('123456.78')} onClear={() => setInput('')} status="实时转换" />
        <div>
          <FieldLabel>{tr("金额")}</FieldLabel>
          <Input aria-label={tr("金额")} placeholder={tr("输入金额，例如 1234.56")} type="number" min="0" step="0.01" value={input} onChange={event => setInput(event.target.value)} />
        </div>
        <div className="tool-panel p-5">
          <div className="mb-2 text-xs font-semibold text-slate-500">{tr("大写结果")}</div>
          <div data-i18n-skip className="break-all text-xl font-semibold leading-8 text-slate-950">{output || '输入金额后显示大写结果'}</div>
        </div>
        <Button className="self-start" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => copy(output)} disabled={!output || output.startsWith('请输入')}>
          {copied ? tr('已复制') : tr('复制结果')}
        </Button>
      </CardContent>
    </Card>
  );
};
