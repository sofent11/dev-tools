import { translateUi as tr, useLocaleRender } from '../../src/i18n/render';
import { convertIdentifierCase } from './text/contentCore';
import { runWorkerTask } from './shared/workerTask';
import type { RegexMatch } from './text/regex.worker';
import { useDraftState } from './shared/useDraftState';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import { ContentEditor, ContentToolbar, ContentOptions } from './shared/ContentWorkflow';

export const CaseConverterTool: React.FC = () => {
  useLocaleRender();
  const [input, setInput] = useDraftState('components/tools/TextTools.tsx:CaseConverterTool:input', '');
  const [selected, setSelected] = useState('camelCase');
  const transformers = ['camelCase', 'snake_case', 'kebab-case', 'PascalCase', 'UPPERCASE', 'lowercase'].map(name => ({ name, fn: (value: string) => convertIdentifierCase(value, name) }));
  const output = transformers.find(transformer => transformer.name === selected)!.fn(input);
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => setInput('user_profile\nproject_name\nhello_world')} onClear={() => setInput('')} status="实时转换"><label className="flex items-center gap-2 text-sm">{tr("目标格式")}<select aria-label={tr("目标格式")} className="rounded-lg border p-2 font-mono" value={selected} onChange={event => setSelected(event.target.value)}>{transformers.map(transformer => <option key={transformer.name}>{transformer.name}</option>)}</select></label></ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={tr("原始文本")} value={input} onChange={setInput} placeholder={tr("输入变量名或粘贴多行文本。")} /><ContentEditor label={selected} value={output} output placeholder={tr("选择目标格式，即时获得结果。")} onUseResult={() => setInput(output)} /></div>
    <details className="tool-panel p-3"><summary className="cursor-pointer text-sm font-medium">{tr("比较所有命名格式")}</summary><div className="mt-3 grid gap-3 md:grid-cols-2">{transformers.map(transformer => <div key={transformer.name} className="min-w-0 rounded-lg border p-3"><div className="mb-2 font-mono text-xs text-slate-500">{transformer.name}</div><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{input ? transformer.fn(input) : '输入文本后显示'}</pre></div>)}</div></details>
  </CardContent></Card>;
};

export const TextStatsTool: React.FC = () => {
  useLocaleRender();
  const [input, setInput] = useDraftState('components/tools/TextTools.tsx:TextStatsTool:input', '');
  const stats = useMemo(() => ({ chars: input.length, charsNoSpace: input.replace(/\s/g, '').length, words: input.trim() ? input.trim().split(/\s+/).length : 0, lines: input ? input.split(/\r\n|\r|\n/).length : 0, codePoints: Array.from(input).length, bytes: new TextEncoder().encode(input).length, chinese: (input.match(/[\u4e00-\u9fff]/g) || []).length }), [input]);
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => setInput('设计源于清晰。\nDesign begins with clarity.\nAtelier 👋')} onClear={() => setInput('')} status="输入后即时统计" />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ContentEditor label={tr("待统计文本")} value={input} onChange={setInput} placeholder={tr("粘贴文章、文档或代码，实时查看长度。")} />
      <aside className="space-y-4"><div className="grid grid-cols-2 gap-3">{[[tr('字符总数'), stats.chars], [tr('非空字符'), stats.charsNoSpace], [tr('单词数'), stats.words], [tr('行数'), stats.lines]].map(([label, count]) => <div key={label} className="tool-panel p-4"><div className="font-mono text-3xl font-semibold text-primary-700">{count.toLocaleString()}</div><div className="mt-2 text-xs text-slate-500">{label}</div></div>)}</div><div className="tool-panel space-y-3 p-4">{[[tr('Unicode 码点'), stats.codePoints], [tr('UTF-8 字节'), stats.bytes], [tr('汉字数'), stats.chinese]].map(([label, count]) => <div key={label} className="flex justify-between gap-2 text-sm"><span className="text-slate-500">{label}</span><span className="font-mono">{count.toLocaleString()}</span></div>)}</div><p className="text-xs leading-5 text-slate-500">{tr("单词按空白分隔；字符总数按 UTF-16 计数。Emoji 可能占用多个字符。")}</p></aside>
    </div>
  </CardContent></Card>;
};

export const RegexTool: React.FC = () => {
  useLocaleRender();
  const [regexStr, setRegexStr] = useDraftState('components/tools/TextTools.tsx:RegexTool:regexStr', '');
  const [flags, setFlags] = useDraftState('components/tools/TextTools.tsx:RegexTool:flags', 'gm');
  const [testString, setTestString] = useDraftState('components/tools/TextTools.tsx:RegexTool:testString', '');
  const [completedMatches, setMatches] = useState<RegexMatch[]>([]);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const [matchedSource, setMatchedSource] = useState('');
  const regexTask = useRef<AbortController | null>(null);
  const sourceKey = JSON.stringify([regexStr, flags, testString]);
  const matches = matchedSource === sourceKey ? completedMatches : [];
  useEffect(() => {
    const controller = new AbortController();
    regexTask.current = controller;
    const timer = window.setTimeout(() => {
      setError('');
      setMatches([]);
      setRunning(Boolean(regexStr));
      if (!regexStr) return;
      void runWorkerTask<RegexMatch[]>(new Worker(new URL('./text/regex.worker.ts', import.meta.url), { type: 'module' }),
        { pattern: regexStr, flags, text: testString }, { signal: controller.signal, timeoutMs: 1500 })
        .then(result => { if (!controller.signal.aborted) { setMatches(result); setMatchedSource(sourceKey); } })
        .catch(error => { if (!controller.signal.aborted) setError(error.message); })
        .finally(() => { if (!controller.signal.aborted) setRunning(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [regexStr, flags, testString, sourceKey]);
  const cancelTask = () => { regexTask.current?.abort(); setRunning(false); setMatches([]); setError('匹配任务已取消；修改表达式或文本后会重新运行。'); };
  const sample = () => { setRegexStr('[\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,}'); setFlags('g'); setTestString('Contact: studio@example.com\nSupport: help@atelier.dev'); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={sample} onClear={() => { setRegexStr(''); setTestString(''); }} status={running ? '正在匹配…' : '实时匹配'}><span className="text-sm font-medium">JavaScript RegExp</span>{running && <button type="button" className="text-xs text-primary-700" onClick={cancelTask}>{tr("取消匹配")}</button>}</ContentToolbar>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]"><label className="text-sm font-medium">{tr("正则表达式")}<input aria-label={tr("正则表达式")} className="mt-2 w-full rounded-lg border p-3 font-mono" placeholder={tr("例如：[a-z]+")} value={regexStr} onChange={event => setRegexStr(event.target.value)} /></label><label className="text-sm font-medium">{tr("匹配标记")}<input aria-label={tr("匹配标记")} className="mt-2 w-full rounded-lg border p-3 font-mono" value={flags} onChange={event => setFlags(event.target.value)} placeholder="gm" /></label></div>
    <ContentOptions title={tr("常用匹配标记")}>{[['g', tr('全部匹配')], ['i', tr('忽略大小写')], ['m', tr('多行模式')], ['s', tr('点匹配换行')], ['u', 'Unicode']].map(([flag, label]) => <label key={flag} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flags.includes(flag)} onChange={event => setFlags(event.target.checked ? flags + flag : flags.replace(flag, ''))} /><code>{flag}</code>{label}</label>)}</ContentOptions>
    <div className="grid gap-4 lg:grid-cols-2">
      <ContentEditor label={tr("测试文本")} value={testString} onChange={setTestString} error={error} placeholder={tr("输入待匹配文本，右侧会显示匹配位置与捕获组。")} />
      <section className="flex min-w-0 flex-col gap-2"><div className="flex min-h-8 items-center justify-between"><span className="text-sm font-semibold">{tr("匹配结果")}</span><span className="text-xs text-slate-500" aria-live="polite">{matches.length}{tr("个匹配")}</span></div><div className="min-h-64 max-h-[34rem] overflow-auto rounded-lg border bg-slate-50 p-3">{matches.length ? matches.slice(0, 500).map((match, index) => <div key={`${match.index}-${index}`} className="mb-2 rounded-lg border bg-white p-3"><div className="mb-2 flex items-center justify-between text-xs text-slate-500"><span>#{index + 1}</span><span>{tr("位置")}{match.index}</span></div><pre className="whitespace-pre-wrap break-all font-mono text-sm">{match.value || '∅'}</pre>{match.groups.length > 0 && <div className="mt-2 border-t pt-2 text-xs text-slate-500">{tr("捕获组：")}{JSON.stringify(match.groups)}</div>}</div>) : <p className="p-6 text-center text-sm text-slate-400">{running ? tr('正在匹配，复杂表达式会在 1.5 秒后终止。') : !regexStr ? tr('先输入表达式与测试文本，或载入示例。') : error ? tr('修正表达式后显示匹配结果。') : tr('没有匹配，试试调整表达式或匹配标记。')}</p>}{matches.length > 500 && <p className="text-xs text-slate-500">{tr("仅展示前 500 个匹配。")}</p>}</div></section>
    </div>
  </CardContent></Card>;
};
