import React, { useEffect, useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import jsyaml from 'js-yaml';
import Papa from 'papaparse';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { marked } from 'marked';
import { sanitizeHtmlMarkup } from './shared/sanitizeMarkup';
import { ScratchpadActionBar, ScratchpadPicker, isScratchpadTextLike } from './shared/ScratchpadControls';
import { useScratchpadStore } from './shared/scratchpadStore';
import { notifyToast } from './shared/notifyToast';
import { ContentEditor, ContentToolbar, ContentOptions } from './shared/ContentWorkflow';

export const XmlTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState('format');
  const [error, setError] = useState<string | null>(null);
  const updateInput = (value: string) => { setInput(value); setOutput(''); setError(null); };
  const run = () => {
    try {
      const valid = XMLValidator.validate(input);
      if (valid !== true) throw new Error(`${valid.err.msg} (line ${valid.err.line})`);
      const obj = new XMLParser({ removeNSPrefix: false, ignoreAttributes: false }).parse(input);
      setOutput(mode === 'json' ? JSON.stringify(obj, null, 2) : new XMLBuilder({ format: mode === 'format', ignoreAttributes: false }).build(obj));
      setError(null);
    } catch (e) { setOutput(''); setError((e as Error).message); }
  };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput('<project name="Atelier"><tool>JSON</tool><tool>Markdown</tool></project>')} onClear={() => updateInput('')}>
      <label className="flex items-center gap-2 text-sm">处理方式<select className="rounded-lg border p-2" value={mode} onChange={event => { setMode(event.target.value); setOutput(''); }}><option value="format">格式化 XML</option><option value="minify">压缩 XML</option><option value="json">XML → JSON</option></select></label>
      <Button onClick={run} disabled={!input.trim()}>开始处理</Button>
    </ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="XML 输入" value={input} onChange={updateInput} error={error} placeholder="粘贴 XML；属性和命名空间会保留。" /><ContentEditor label={mode === 'json' ? 'JSON 输出' : 'XML 输出'} value={output} output placeholder="选择处理方式后生成结果。" onUseResult={mode === 'json' ? undefined : () => updateInput(output)} /></div>
  </CardContent></Card>;
};

const DataConverter: React.FC<{ kind: 'yaml' | 'csv' }> = ({ kind }) => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [toJson, setToJson] = useState(true);
  const [header, setHeader] = useState(true);
  const [delimiter, setDelimiter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const format = kind.toUpperCase();
  const updateInput = (value: string) => { setInput(value); setOutput(''); setError(null); };
  const run = () => {
    try {
      if (toJson && kind === 'yaml') setOutput(JSON.stringify(jsyaml.load(input), null, 2) ?? 'null');
      else if (!toJson && kind === 'yaml') setOutput(jsyaml.dump(JSON.parse(input)));
      else if (toJson) {
        const result = Papa.parse(input, { header, delimiter, skipEmptyLines: true });
        if (result.errors.length) throw new Error(result.errors[0].message);
        setOutput(JSON.stringify(result.data, null, 2));
      } else setOutput(Papa.unparse(JSON.parse(input), delimiter ? { delimiter } : {}));
      setError(null);
    } catch (e) { setOutput(''); setError((e as Error).message); }
  };
  const sample = () => updateInput(!toJson ? '[{"name":"Atelier","version":1},{"name":"Studio","version":2}]' : kind === 'yaml' ? 'project: Atelier\nversion: 1\ntools:\n  - JSON\n  - Markdown' : 'name,version\nAtelier,1\nStudio,2');
  const stashOutput = async () => {
    await useScratchpadStore.getState().addItemAsync({ name: `${kind}_json_${Date.now()}.${toJson ? 'json' : kind}`, content: output, type: toJson ? 'json' : 'text', mimeType: toJson ? 'application/json' : kind === 'csv' ? 'text/csv' : 'text/yaml', sourceTool: `${format} ↔ JSON` });
    notifyToast({ title: '转换结果已送入暂存箱', tone: 'success' });
  };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={sample} onClear={() => updateInput('')}>
      <div className="flex rounded-lg border p-1"><Button size="sm" variant={toJson ? 'primary' : 'ghost'} onClick={() => { setToJson(true); setOutput(''); setError(null); }}>{format} → JSON</Button><Button size="sm" variant={!toJson ? 'primary' : 'ghost'} onClick={() => { setToJson(false); setOutput(''); setError(null); }}>JSON → {format}</Button></div>
      <Button onClick={run} disabled={!input.trim()}>转换</Button>
      <Button size="sm" variant="secondary" onClick={() => { updateInput(output); setToJson(!toJson); }} disabled={!output} icon={<ArrowRightLeft className="h-4 w-4" />}>反向转换</Button>
    </ContentToolbar>
    {kind === 'csv' && <ContentOptions><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={header} onChange={event => { setHeader(event.target.checked); setOutput(''); }} disabled={!toJson} />首行作为字段名</label><label className="flex items-center gap-2 text-sm">分隔符<select className="rounded border p-2" value={delimiter} onChange={event => { setDelimiter(event.target.value); setOutput(''); }}><option value="">自动检测</option><option value=",">逗号</option><option value=";">分号</option><option value={'\t'}>Tab</option></select></label></ContentOptions>}
    <div className="grid gap-4 lg:grid-cols-2">
      <ContentEditor label={`${toJson ? format : 'JSON'} 输入`} value={input} onChange={updateInput} error={error} placeholder={`粘贴 ${toJson ? format : 'JSON'} 内容。`} />
      <ContentEditor label={`${toJson ? 'JSON' : format} 输出`} value={output} output placeholder="转换结果可以复制、暂存或反向转换。" actions={<Button size="xs" variant="secondary" onClick={stashOutput} disabled={!output}>暂存</Button>} />
    </div>
    <details><summary className="cursor-pointer text-xs text-slate-500">从暂存箱载入</summary><ScratchpadActionBar className="mt-2"><ScratchpadPicker label={`载入 ${format} / JSON`} placeholder="从暂存箱载入..." filter={isScratchpadTextLike} onLoad={async content => updateInput(typeof content === 'string' ? content : await new Blob([content]).text())} /></ScratchpadActionBar></details>
  </CardContent></Card>;
};
export const YamlTool: React.FC = () => <DataConverter kind="yaml" />;
export const CsvTool: React.FC = () => <DataConverter kind="csv" />;

const markdownSample = '# Atelier\n\n把想法写成结构清晰的文档。\n\n- 编辑左侧内容\n- 实时检查预览\n- 复制生成的 HTML\n\n```typescript\nconst studio = "Atelier";\n```';
export const MarkdownTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [html, setHtml] = useState('');
  const [view, setView] = useState<'preview' | 'source'>('preview');
  useEffect(() => {
    let active = true;
    const parse = async () => { const result = await marked.parse(input); if (active) setHtml(sanitizeHtmlMarkup(result)); };
    void parse();
    return () => { active = false; };
  }, [input]);
  const stashHtml = async () => {
    await useScratchpadStore.getState().addItemAsync({ name: `markdown_preview_${Date.now()}.html`, content: html, type: 'text', mimeType: 'text/html', sourceTool: 'Markdown 预览' });
    notifyToast({ title: 'HTML 预览已送入暂存箱', tone: 'success' });
  };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => setInput(markdownSample)} onClear={() => setInput('')} status="实时预览">
      <div className="flex rounded-lg border p-1"><Button size="sm" variant={view === 'preview' ? 'primary' : 'ghost'} onClick={() => setView('preview')}>预览</Button><Button size="sm" variant={view === 'source' ? 'primary' : 'ghost'} onClick={() => setView('source')}>HTML 源码</Button></div>
    </ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2">
      <ContentEditor label="Markdown 输入" value={input} onChange={setInput} placeholder="开始写作，或载入示例查看标题、列表与代码块。" />
      <ContentEditor label={view === 'preview' ? '渲染预览' : 'HTML 输出'} value={html} output actions={<Button size="xs" variant="secondary" onClick={stashHtml} disabled={!html}>暂存 HTML</Button>}>
        {view === 'preview' ? <div className="min-h-64 overflow-auto rounded-lg border border-slate-200 bg-white p-6">{input ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} /> : <div className="flex min-h-52 items-center justify-center text-sm text-slate-400">在左侧输入 Markdown，即时查看排版效果。</div>}</div> : null}
      </ContentEditor>
    </div>
    <details><summary className="cursor-pointer text-xs text-slate-500">从暂存箱载入</summary><ScratchpadActionBar className="mt-2"><ScratchpadPicker label="载入 Markdown" placeholder="从暂存箱载入 Markdown..." filter={isScratchpadTextLike} onLoad={async content => setInput(typeof content === 'string' ? content : await new Blob([content]).text())} /></ScratchpadActionBar></details>
  </CardContent></Card>;
};
