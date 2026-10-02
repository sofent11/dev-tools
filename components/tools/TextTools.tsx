import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import { ContentEditor, ContentToolbar, ContentOptions } from './shared/ContentWorkflow';

export const CaseConverterTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState('camelCase');
  const transformers = [
    { name: 'camelCase', fn: (s: string) => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', '')) },
    { name: 'snake_case', fn: (s: string) => s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '') },
    { name: 'kebab-case', fn: (s: string) => s.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '') },
    { name: 'PascalCase', fn: (s: string) => s.replace(/(\w)(\w*)/g, (g0, g1, g2) => g1.toUpperCase() + g2.toLowerCase()).replace(/[-_]/g, '') },
    { name: 'UPPERCASE', fn: (s: string) => s.toUpperCase() },
    { name: 'lowercase', fn: (s: string) => s.toLowerCase() },
  ];
  const output = transformers.find(transformer => transformer.name === selected)!.fn(input);
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => setInput('user_profile\nproject_name\nhello_world')} onClear={() => setInput('')} status="实时转换"><label className="flex items-center gap-2 text-sm">目标格式<select aria-label="目标格式" className="rounded-lg border p-2 font-mono" value={selected} onChange={event => setSelected(event.target.value)}>{transformers.map(transformer => <option key={transformer.name}>{transformer.name}</option>)}</select></label></ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="原始文本" value={input} onChange={setInput} placeholder="输入变量名或粘贴多行文本。" /><ContentEditor label={selected} value={output} output placeholder="选择目标格式，即时获得结果。" onUseResult={() => setInput(output)} /></div>
    <details className="tool-panel p-3"><summary className="cursor-pointer text-sm font-medium">比较所有命名格式</summary><div className="mt-3 grid gap-3 md:grid-cols-2">{transformers.map(transformer => <div key={transformer.name} className="min-w-0 rounded-lg border p-3"><div className="mb-2 font-mono text-xs text-slate-500">{transformer.name}</div><pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{input ? transformer.fn(input) : '输入文本后显示'}</pre></div>)}</div></details>
  </CardContent></Card>;
};

export const TextStatsTool: React.FC = () => {
  const [input, setInput] = useState('');
  const stats = useMemo(() => ({ chars: input.length, charsNoSpace: input.replace(/\s/g, '').length, words: input.trim() ? input.trim().split(/\s+/).length : 0, lines: input ? input.split(/\r\n|\r|\n/).length : 0, codePoints: Array.from(input).length, bytes: new TextEncoder().encode(input).length, chinese: (input.match(/[\u4e00-\u9fff]/g) || []).length }), [input]);
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => setInput('设计源于清晰。\nDesign begins with clarity.\nAtelier 👋')} onClear={() => setInput('')} status="输入后即时统计" />
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ContentEditor label="待统计文本" value={input} onChange={setInput} placeholder="粘贴文章、文档或代码，实时查看长度。" />
      <aside className="space-y-4"><div className="grid grid-cols-2 gap-3">{[['字符总数', stats.chars], ['非空字符', stats.charsNoSpace], ['单词数', stats.words], ['行数', stats.lines]].map(([label, count]) => <div key={label} className="tool-panel p-4"><div className="font-mono text-3xl font-semibold text-primary-700">{count.toLocaleString()}</div><div className="mt-2 text-xs text-slate-500">{label}</div></div>)}</div><div className="tool-panel space-y-3 p-4">{[['Unicode 码点', stats.codePoints], ['UTF-8 字节', stats.bytes], ['汉字数', stats.chinese]].map(([label, count]) => <div key={label} className="flex justify-between gap-2 text-sm"><span className="text-slate-500">{label}</span><span className="font-mono">{count.toLocaleString()}</span></div>)}</div><p className="text-xs leading-5 text-slate-500">单词按空白分隔；字符总数按 UTF-16 计数。Emoji 可能占用多个字符。</p></aside>
    </div>
  </CardContent></Card>;
};

export const RegexTool: React.FC = () => {
  const [regexStr, setRegexStr] = useState('');
  const [flags, setFlags] = useState('gm');
  const [testString, setTestString] = useState('');
  const { matches, error } = useMemo(() => {
    if (!regexStr) return { matches: [], error: '' };
    try {
      const regex = new RegExp(regexStr, flags);
      if (!flags.includes('g')) {
        const found = regex.exec(testString);
        return { matches: found ? [{ value: found[0], index: found.index, groups: found.slice(1) }] : [], error: '' };
      }
      return { matches: Array.from(testString.matchAll(regex), found => ({ value: found[0], index: found.index, groups: found.slice(1) })), error: '' };
    } catch (e) { return { matches: [], error: (e as Error).message }; }
  }, [regexStr, flags, testString]);
  const sample = () => { setRegexStr('[\\w.+-]+@[\\w.-]+\\.[a-zA-Z]{2,}'); setFlags('g'); setTestString('Contact: studio@example.com\nSupport: help@atelier.dev'); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={sample} onClear={() => { setRegexStr(''); setTestString(''); }} status="实时匹配"><span className="text-sm font-medium">JavaScript RegExp</span></ContentToolbar>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]"><label className="text-sm font-medium">正则表达式<input aria-label="正则表达式" className="mt-2 w-full rounded-lg border p-3 font-mono" placeholder="例如：[a-z]+" value={regexStr} onChange={event => setRegexStr(event.target.value)} /></label><label className="text-sm font-medium">匹配标记<input aria-label="匹配标记" className="mt-2 w-full rounded-lg border p-3 font-mono" value={flags} onChange={event => setFlags(event.target.value)} placeholder="gm" /></label></div>
    <ContentOptions title="常用匹配标记">{[['g', '全部匹配'], ['i', '忽略大小写'], ['m', '多行模式'], ['s', '点匹配换行'], ['u', 'Unicode']].map(([flag, label]) => <label key={flag} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flags.includes(flag)} onChange={event => setFlags(event.target.checked ? flags + flag : flags.replace(flag, ''))} /><code>{flag}</code>{label}</label>)}</ContentOptions>
    <div className="grid gap-4 lg:grid-cols-2">
      <ContentEditor label="测试文本" value={testString} onChange={setTestString} error={error} placeholder="输入待匹配文本，右侧会显示匹配位置与捕获组。" />
      <section className="flex min-w-0 flex-col gap-2"><div className="flex min-h-8 items-center justify-between"><span className="text-sm font-semibold">匹配结果</span><span className="text-xs text-slate-500" aria-live="polite">{matches.length} 个匹配</span></div><div className="min-h-64 max-h-[34rem] overflow-auto rounded-lg border bg-slate-50 p-3">{matches.length ? matches.slice(0, 500).map((match, index) => <div key={`${match.index}-${index}`} className="mb-2 rounded-lg border bg-white p-3"><div className="mb-2 flex items-center justify-between text-xs text-slate-500"><span>#{index + 1}</span><span>位置 {match.index}</span></div><pre className="whitespace-pre-wrap break-all font-mono text-sm">{match.value || '∅'}</pre>{match.groups.length > 0 && <div className="mt-2 border-t pt-2 text-xs text-slate-500">捕获组：{JSON.stringify(match.groups)}</div>}</div>) : <p className="p-6 text-center text-sm text-slate-400">{!regexStr ? '先输入表达式与测试文本，或载入示例。' : error ? '修正表达式后显示匹配结果。' : '没有匹配，试试调整表达式或匹配标记。'}</p>}{matches.length > 500 && <p className="text-xs text-slate-500">仅展示前 500 个匹配。</p>}</div></section>
    </div>
  </CardContent></Card>;
};
