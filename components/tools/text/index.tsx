import React, { useMemo, useState } from 'react';
import TurndownService from 'turndown';
import { ArrowRightLeft, Check, Copy, FileCode, Minimize2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Textarea } from '../../ui/ToolUi';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';

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
  const [input, setInput] = useState(sampleHtml);
  const { copied, copy } = useCopyToClipboard();

  const output = useMemo(() => {
    const service = new TurndownService({
      codeBlockStyle: 'fenced',
      headingStyle: 'atx',
      bulletListMarker: '-',
    });
    return input.trim() ? service.turndown(input) : '';
  }, [input]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="HTML 转 Markdown" description="在浏览器本地把 HTML 片段转换为 Markdown。" />
      <CardContent className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-2">
          <FieldLabel>HTML 输入</FieldLabel>
          <Textarea className="min-h-0 flex-1 resize-none font-mono" value={input} onChange={event => setInput(event.target.value)} />
        </div>
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Markdown 输出</FieldLabel>
            <Button size="sm" variant="secondary" onClick={() => copy(output)} disabled={!output}>
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 font-mono" value={output} />
        </div>
      </CardContent>
    </Card>
  );
};

export const HtmlFormatTool: React.FC = () => {
  const [input, setInput] = useState(sampleHtml);
  const [error, setError] = useState('');
  const { copied, copy } = useCopyToClipboard();

  const run = (mode: 'format' | 'minify') => {
    try {
      setInput(mode === 'format' ? formatHtml(input) : minifyHtml(input));
      setError('');
    } catch (event) {
      setError(event instanceof Error ? event.message : 'HTML 处理失败');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="HTML 格式化/压缩器"
        description="轻量格式化 HTML，或压缩基础空白字符。"
        actions={
          <>
            <Button size="sm" variant="secondary" icon={<Minimize2 className="h-4 w-4" />} onClick={() => run('minify')}>压缩</Button>
            <Button size="sm" icon={<FileCode className="h-4 w-4" />} onClick={() => run('format')}>格式化</Button>
          </>
        }
      />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex items-center justify-between">
          <FieldLabel>HTML</FieldLabel>
          <Button size="sm" variant="secondary" onClick={() => copy(input)} disabled={!input}>
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <Textarea className="min-h-0 flex-1 resize-none font-mono" value={input} onChange={event => setInput(event.target.value)} />
        {error && <div className="status-error p-3 text-sm">{error}</div>}
      </CardContent>
    </Card>
  );
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
  const output = useMemo(() => toRmbUppercase(input), [input]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="人民币大写" description="金额数字转换为中文大写金额。" />
      <CardContent className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-5">
        <div>
          <FieldLabel>金额</FieldLabel>
          <Input type="number" min="0" step="0.01" value={input} onChange={event => setInput(event.target.value)} />
        </div>
        <div className="tool-panel p-5">
          <div className="mb-2 text-xs font-semibold text-slate-500">大写结果</div>
          <div className="break-all text-xl font-semibold leading-8 text-slate-950">{output}</div>
        </div>
        <Button className="self-start" icon={<ArrowRightLeft className="h-4 w-4" />} onClick={() => copy(output)}>
          {copied ? '已复制' : '复制结果'}
        </Button>
      </CardContent>
    </Card>
  );
};
