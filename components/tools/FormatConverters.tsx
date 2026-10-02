import { translateUi as tr, useLocaleRender } from '../../src/i18n/render';
import { useDraftState } from './shared/useDraftState';
import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { ScratchpadActionBar, ScratchpadPicker, isScratchpadTextLike } from './shared/ScratchpadControls';
import { useScratchpadStore } from './shared/scratchpadStore';
import { notifyToast } from './shared/notifyToast';
import { ContentEditor, ContentToolbar } from './shared/ContentWorkflow';

export const JsonTool: React.FC = () => {
  useLocaleRender();
  const [input, setInput] = useDraftState('components/tools/FormatConverters.tsx:JsonTool:input', '');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [indent, setIndent] = useState(2);
  const [operation, setOperation] = useState('格式化');
  const process = (minify: boolean) => {
    try {
      setOutput(JSON.stringify(JSON.parse(input), null, minify ? undefined : indent));
      setOperation(minify ? '压缩' : '格式化');
      setError(null);
    } catch (e) {
      setOutput('');
      setError((e as Error).message);
    }
  };
  const updateInput = (value: string) => { setInput(value); setError(null); setOutput(''); };
  const stashJson = async () => {
    await useScratchpadStore.getState().addItemAsync({ name: `json_${Date.now()}.json`, content: output, type: 'json', mimeType: 'application/json', sourceTool: 'JSON 格式化' });
    notifyToast({ title: 'JSON 已送入暂存箱', tone: 'success' });
  };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 flex flex-col gap-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput('{"project":"Atelier","tools":["JSON","Markdown"],"active":true}')} onClear={() => updateInput('')}>
      <Button onClick={() => process(false)} disabled={!input.trim()}>{tr("格式化")}</Button>
      <Button variant="secondary" onClick={() => process(true)} disabled={!input.trim()}>{tr("压缩")}</Button>
      <label className="flex items-center gap-2 text-xs text-slate-500">{tr("缩进")}<select aria-label={tr("缩进")} className="rounded border px-2 py-1" value={indent} onChange={event => setIndent(Number(event.target.value))}><option value={2}>2</option><option value={4}>4</option></select></label>
    </ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2">
      <ContentEditor label={tr("原始 JSON")} value={input} onChange={updateInput} error={error} placeholder={tr("粘贴 JSON；原始内容会保留在这里。")} />
      <ContentEditor label={`${operation}结果`} value={output} output placeholder={tr("处理后的 JSON 显示在这里。")} onUseResult={() => updateInput(output)} actions={<Button size="xs" variant="secondary" onClick={stashJson} disabled={!output}>{tr("暂存")}</Button>} />
    </div>
    <details><summary className="cursor-pointer text-xs text-slate-500">{tr("从暂存箱载入")}</summary><ScratchpadActionBar className="mt-2"><ScratchpadPicker label={tr("载入 JSON / 文本")} placeholder={tr("从暂存箱载入 JSON...")} filter={isScratchpadTextLike} onLoad={async content => updateInput(typeof content === 'string' ? content : await new Blob([content]).text())} /></ScratchpadActionBar></details>
  </CardContent></Card>;
};

const CodecWorkbench: React.FC<{ kind: 'base64' | 'url' }> = ({ kind }) => {
  useLocaleRender();
  const [input, setInput] = useDraftState(`components/tools/FormatConverters.tsx:CodecWorkbench:input:${kind}`, '');
  const [output, setOutput] = useState('');
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [error, setError] = useState<string | null>(null);
  const updateInput = (value: string) => { setInput(value); setOutput(''); setError(null); };
  const process = () => {
    try {
      if (kind === 'url') setOutput(mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input));
      else setOutput(mode === 'encode' ? btoa(unescape(encodeURIComponent(input))) : decodeURIComponent(escape(atob(input))));
      setError(null);
    } catch {
      setOutput('');
      setError(kind === 'url' ? 'URL 转义不完整，请检查百分号后的十六进制编码。' : '无法转换，请检查 Base64 格式或文本编码。');
    }
  };
  const reverse = () => { updateInput(output); setMode(mode === 'encode' ? 'decode' : 'encode'); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 flex flex-col gap-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput(mode === 'encode' ? 'Hello, 世界!' : kind === 'base64' ? 'SGVsbG8sIOS4lueVjCE=' : 'Hello%2C%20%E4%B8%96%E7%95%8C!')} onClear={() => updateInput('')}>
      <div className="flex rounded-lg border border-slate-200 p-1">{(['encode', 'decode'] as const).map(value => <Button key={value} size="sm" variant={mode === value ? 'primary' : 'ghost'} onClick={() => { setMode(value); setOutput(''); setError(null); }}>{value === 'encode' ? tr('编码') : tr('解码')}</Button>)}</div>
      <Button onClick={process} disabled={!input}>{mode === 'encode' ? tr('开始编码') : tr('开始解码')}</Button>
      <Button variant="secondary" size="sm" onClick={reverse} disabled={!output} icon={<ArrowRightLeft className="h-4 w-4" />}>{tr("反向转换")}</Button>
    </ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2">
      <ContentEditor label={mode === 'encode' ? tr('原始文本') : kind === 'base64' ? tr('Base64 输入') : tr('URL 编码输入')} value={input} onChange={updateInput} error={error} placeholder={mode === 'encode' ? tr('输入要编码的文本，支持中文和 Emoji。') : tr('粘贴要解码的内容。')} />
      <ContentEditor label={mode === 'encode' ? tr('编码结果') : tr('解码文本')} value={output} output placeholder={tr("完成转换后可以复制，或反向转换校验。")} />
    </div>
    {kind === 'url' && <p className="text-xs text-slate-500">{tr("按 URL 参数编码，适合查询参数中的文本和值。")}</p>}
  </CardContent></Card>;
};
export const Base64Tool: React.FC = () => { useLocaleRender(); return (<CodecWorkbench kind="base64" />); };
export const UrlTool: React.FC = () => { useLocaleRender(); return (<CodecWorkbench kind="url" />); };
