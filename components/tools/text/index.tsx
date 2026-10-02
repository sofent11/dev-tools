import React, { useMemo, useState } from 'react';
import TurndownService from 'turndown';
import { ArrowRightLeft, FileCode, Minimize2 } from 'lucide-react';
import { Card, CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';
import { ContentEditor, ContentToolbar, ContentOptions } from '../shared/ContentWorkflow';

const sampleHtml = '<article><h1>Hello</h1><p>Paste HTML here.</p><ul><li>Local only</li></ul></article>';

const formatHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(`<template>${html}</template>`, 'text/html');
  const template = doc.querySelector('template');
  if (!template) return html;

  const formatNode = (node: Node, depth: number): string => {
    const indent = '  '.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, ' ').trim() || '';
      return text ? `${indent}${text}` : '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node as Element;
    const attrs = Array.from(element.attributes)
      .map(attr => `${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`)
      .join(' ');
    const open = attrs ? `<${element.tagName.toLowerCase()} ${attrs}>` : `<${element.tagName.toLowerCase()}>`;
    const children = Array.from(element.childNodes).map(child => formatNode(child, depth + 1)).filter(Boolean);
    if (children.length === 0) return `${indent}${open}</${element.tagName.toLowerCase()}>`;
    return `${indent}${open}\n${children.join('\n')}\n${indent}</${element.tagName.toLowerCase()}>`;
  };

  return Array.from(template.content.childNodes).map(node => formatNode(node, 0)).filter(Boolean).join('\n');
};

const minifyHtml = (html: string) =>
  html
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();

export const HtmlToMarkdownTool: React.FC = () => {
  const [input, setInput] = useState('');
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
    <ContentOptions title="Markdown 输出选项"><label className="flex items-center gap-2 text-sm">标题格式<select aria-label="标题格式" className="rounded border p-2" value={heading} onChange={event => setHeading(event.target.value as typeof heading)}><option value="atx"># 标题</option><option value="setext">下划线标题</option></select></label><label className="flex items-center gap-2 text-sm">代码块<select aria-label="代码块" className="rounded border p-2" value={codeStyle} onChange={event => setCodeStyle(event.target.value as typeof codeStyle)}><option value="fenced">围栏代码块</option><option value="indented">缩进代码块</option></select></label></ContentOptions>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="HTML 输入" value={input} onChange={setInput} error={result.error} placeholder="粘贴 HTML 片段，转换后的 Markdown 即时显示。" /><ContentEditor label="Markdown 输出" value={result.output} output placeholder="转换结果会保留标题、列表、链接与代码结构。" /></div>
  </CardContent></Card>;
};

export const HtmlFormatTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const updateInput = (value: string) => { setInput(value); setOutput(''); setError(''); };
  const run = (mode: 'format' | 'minify') => {
    try { setOutput(mode === 'format' ? formatHtml(input) : minifyHtml(input)); setError(''); }
    catch (event) { setOutput(''); setError(event instanceof Error ? event.message : 'HTML 处理失败'); }
  };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput(sampleHtml)} onClear={() => updateInput('')}><Button icon={<FileCode className="h-4 w-4" />} onClick={() => run('format')} disabled={!input.trim()}>格式化</Button><Button variant="secondary" icon={<Minimize2 className="h-4 w-4" />} onClick={() => run('minify')} disabled={!input.trim()}>压缩</Button></ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="HTML 输入" value={input} onChange={updateInput} error={error} placeholder="粘贴 HTML，原始输入会保留。" /><ContentEditor label="HTML 输出" value={output} output placeholder="格式化或压缩后查看结果。" onUseResult={() => updateInput(output)} /></div>
    <p className="text-xs text-slate-500">轻量模式会调整基础空白字符；包含依赖空白的内容时请检查处理结果。</p>
  </CardContent></Card>;
};

const rmbDigits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
const rmbUnits = ['', '拾', '佰', '仟'];
const rmbSections = ['', '万', '亿', '兆'];
const maxRmbAmount = 999999999999999;

const sectionToChinese = (section: number) => {
  let output = '';
  let unitIndex = 0;
  let zero = true;
  while (section > 0) {
    const digit = section % 10;
    if (digit === 0) {
      if (!zero) {
        zero = true;
        output = rmbDigits[0] + output;
      }
    } else {
      zero = false;
      output = rmbDigits[digit] + rmbUnits[unitIndex] + output;
    }
    unitIndex += 1;
    section = Math.floor(section / 10);
  }
  return output;
};

const toRmbUppercase = (value: string) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > maxRmbAmount) return '请输入 0 到 999999999999999 之间的金额';
  if (amount === 0) return '零元整';

  const cents = Math.round(amount * 100);
  let integer = Math.floor(cents / 100);
  const jiao = Math.floor((cents % 100) / 10);
  const fen = cents % 10;
  let sectionIndex = 0;
  let integerOutput = '';
  let needZero = false;

  while (integer > 0) {
    const section = integer % 10000;
    if (section === 0) {
      needZero = true;
    } else {
      let sectionText = sectionToChinese(section);
      if (needZero) {
        sectionText = rmbDigits[0] + sectionText;
        needZero = false;
      }
      integerOutput = sectionText + rmbSections[sectionIndex] + integerOutput;
    }
    sectionIndex += 1;
    integer = Math.floor(integer / 10000);
  }

  const decimalOutput = jiao === 0 && fen === 0
    ? '整'
    : `${jiao ? rmbDigits[jiao] + '角' : fen ? '零' : ''}${fen ? rmbDigits[fen] + '分' : ''}`;

  return `${integerOutput.replace(/零+/g, '零').replace(/零$/g, '')}元${decimalOutput}`;
};

export const RmbUppercaseTool: React.FC = () => {
  const [input, setInput] = useState('123456.78');
  const { copied, copy } = useCopyToClipboard();
  const output = useMemo(() => input.trim() ? toRmbUppercase(input) : '', [input]);

  return (
    <Card className="h-full flex flex-col">

      <CardContent className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-5 overflow-auto">
        <ContentToolbar onSample={() => setInput('123456.78')} onClear={() => setInput('')} status="实时转换" />
        <div>
          <FieldLabel>金额</FieldLabel>
          <Input aria-label="金额" placeholder="输入金额，例如 1234.56" type="number" min="0" step="0.01" value={input} onChange={event => setInput(event.target.value)} />
        </div>
        <div className="tool-panel p-5">
          <div className="mb-2 text-xs font-semibold text-slate-500">大写结果</div>
          <div className="break-all text-xl font-semibold leading-8 text-slate-950">{output || '输入金额后显示大写结果'}</div>
        </div>
        <Button className="self-start" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => copy(output)} disabled={!output || output.startsWith('请输入')}>
          {copied ? '已复制' : '复制结果'}
        </Button>
      </CardContent>
    </Card>
  );
};
