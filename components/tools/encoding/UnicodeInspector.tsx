import React, { useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { useI18n } from '../../../src/i18n';
import { Button } from '../../ui/Button';
import { ContentToolbar } from '../shared/ContentWorkflow';
import {
  analyzeUnicodeText,
  lookupByCodePoint,
  parseUnicodeDataText,
  searchUnicodeNames,
  type UnicodeCharacterDetail,
  type UnicodeNameMap,
} from './unicodeInspectorCore';

const copyText = {
  'zh-CN': {
    title: 'Unicode 字符检查器',
    text: '待分析文本',
    lookupCode: '按码点查询',
    lookupName: '按名称查询',
    sequential: '保留重复字符',
    loadData: '加载 UnicodeData.txt',
    dataLoaded: '已加载名称',
    analyze: '分析',
    chars: '字符详情',
    blocks: '区块统计',
    emoji: 'Emoji 序列',
    name: '名称',
    char: '字符',
    code: '码点',
    block: '区块',
    utf8: 'UTF-8',
    utf16: 'UTF-16 BE',
    utf16le: 'UTF-16 LE',
    noResults: '暂无结果',
    codePlaceholder: '例如 U+4E2D',
    namePlaceholder: '例如 LATIN SMALL LETTER A',
  },
  'en-US': {
    title: 'Unicode Character Inspector',
    text: 'Text to analyze',
    lookupCode: 'Lookup by code point',
    lookupName: 'Lookup by name',
    sequential: 'Keep duplicate characters',
    loadData: 'Load UnicodeData.txt',
    dataLoaded: 'names loaded',
    analyze: 'Analyze',
    chars: 'Character details',
    blocks: 'Block summary',
    emoji: 'Emoji sequences',
    name: 'Name',
    char: 'Char',
    code: 'Code point',
    block: 'Block',
    utf8: 'UTF-8',
    utf16: 'UTF-16 BE',
    utf16le: 'UTF-16 LE',
    noResults: 'No results yet',
    codePlaceholder: 'Example U+4E2D',
    namePlaceholder: 'Example LATIN SMALL LETTER A',
  },
} as const;

type UnicodeCopy = Record<keyof typeof copyText['zh-CN'], string>;

const DetailTable: React.FC<{ rows: UnicodeCharacterDetail[]; c: UnicodeCopy; encodings?: boolean }> = ({ rows, c, encodings = false }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <tr>
          <th className="px-3 py-2 text-left">{c.char}</th>
          <th className="px-3 py-2 text-left">{c.code}</th>
          <th className="px-3 py-2 text-left">{c.name}</th>
          <th className="px-3 py-2 text-left">{c.block}</th>
          <th className="px-3 py-2 text-left">{c.utf8}</th>
          {encodings && <><th className="px-3 py-2 text-left">{c.utf16}</th><th className="px-3 py-2 text-left">{c.utf16le}</th></>}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((row, index) => (
          <tr key={`${row.codePointLabel}-${index}`} className="align-top">
            <td className="px-3 py-2 text-xl">{row.char}</td>
            <td className="px-3 py-2 font-mono text-primary-700 dark:text-primary-300">{row.codePointLabel}</td>
            <td className="px-3 py-2">{row.name}</td>
            <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{row.block}</td>
            <td className="px-3 py-2 font-mono text-xs">{row.utf8Hex}</td>
            {encodings && <><td className="px-3 py-2 font-mono text-xs">{row.utf16Hex}</td><td className="px-3 py-2 font-mono text-xs">{row.utf16LeHex}</td></>}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const UnicodeInspector: React.FC = () => {
  const { locale } = useI18n();
  const c: UnicodeCopy = copyText[locale];
  const [text, setText] = useState('');
  const [view, setView] = useState<'characters' | 'emoji' | 'blocks'>('characters');
  const [encodings, setEncodings] = useState(false);
  const [dataError, setDataError] = useState('');
  const [sequential, setSequential] = useState(false);
  const [nameMap, setNameMap] = useState<UnicodeNameMap>(() => new Map());
  const [codeQuery, setCodeQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const analysis = useMemo(() => analyzeUnicodeText(text, { sequential, nameMap }), [nameMap, sequential, text]);
  const codeLookup = useMemo(() => {
    if (!codeQuery.trim()) return { rows: [], error: '' };
    try { return { rows: [lookupByCodePoint(codeQuery, nameMap)], error: '' }; }
    catch (error) { return { rows: [], error: error instanceof Error ? error.message : '无效码点' }; }
  }, [codeQuery, nameMap]);
  const nameLookup = useMemo(() => searchUnicodeNames(nameQuery, nameMap, 20), [nameMap, nameQuery]);

  const handleUnicodeDataFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const data = parseUnicodeDataText(content);
      if (!data.size) { setDataError('文件中没有可识别的 Unicode 字符名称。'); return; }
      setNameMap(data);
      setDataError('');
    } catch (error) { setDataError(error instanceof Error ? error.message : '无法读取字符名称文件。'); }
  };

  return <div className="space-y-4">
    <section className="tool-panel space-y-4 p-4">
      <ContentToolbar onSample={() => setText('Hello 世界 👋 € α 👍🏽')} onClear={() => { setText(''); setCodeQuery(''); setNameQuery(''); }} status={`${Array.from(text).length} 码点 · ${analysis.characters.length} 个字符`} />
      <label className="block text-sm font-semibold" htmlFor="unicode-text">{c.text}</label>
      <textarea id="unicode-text" value={text} onChange={event => setText(event.target.value)} placeholder="输入文本，检查字符、编码与 Emoji 序列。" className="min-h-32 w-full resize-y rounded-lg border bg-white p-4 text-sm" />
      <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={sequential} onChange={event => setSequential(event.target.checked)} />{c.sequential}</label><label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={encodings} onChange={event => setEncodings(event.target.checked)} />显示 UTF-16 编码</label></div>
    </section>
    <section className="tool-panel space-y-4 p-4">
      <div className="flex flex-wrap gap-2 border-b pb-3">{[{ id: 'characters' as const, label: c.chars }, { id: 'blocks' as const, label: c.blocks }, { id: 'emoji' as const, label: c.emoji }].map(tab => <Button key={tab.id} size="sm" variant={view === tab.id ? 'primary' : 'ghost'} onClick={() => setView(tab.id)}>{tab.label}</Button>)}</div>
      {view === 'characters' ? analysis.characters.length ? <DetailTable rows={analysis.characters} c={c} encodings={encodings} /> : <p className="py-8 text-center text-sm text-slate-400">输入文本或载入示例，即时分析每个字符。</p> : view === 'blocks' ? <div className="grid gap-2 sm:grid-cols-2">{analysis.blocks.length ? analysis.blocks.map(block => <div key={block.block} className="flex justify-between rounded-lg border bg-slate-50 p-3 text-sm"><span>{block.block}</span><span className="font-mono text-primary-700">{block.count}</span></div>) : <p className="py-8 text-sm text-slate-400">{c.noResults}</p>}</div> : <div className="grid gap-3 sm:grid-cols-2">{analysis.emojiSequences.length ? analysis.emojiSequences.map(item => <div key={`${item.sequence}-${item.name}`} className="rounded-lg border bg-slate-50 p-4"><div className="mb-2 text-3xl">{item.sequence}</div><div className="text-sm font-medium">{item.name}</div><div className="mt-2 font-mono text-xs text-slate-500">{item.codePoints}</div></div>) : <p className="py-8 text-sm text-slate-400">{c.noResults}</p>}</div>}
    </section>
    <details className="tool-panel p-4"><summary className="cursor-pointer text-sm font-medium">按码点或名称查询 · 加载字符名称数据</summary><div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs"><FileUp className="h-4 w-4" />{c.loadData}<input type="file" accept=".txt" className="sr-only" onChange={handleUnicodeDataFile} /></label><span className="text-xs text-slate-500">{nameMap.size.toLocaleString()} {c.dataLoaded}</span>{dataError && <span role="alert" className="text-xs text-red-600">{dataError}</span>}</div>
      <div className="grid gap-4 lg:grid-cols-2"><div className="space-y-3"><label className="text-sm font-medium" htmlFor="unicode-code">{c.lookupCode}</label><input id="unicode-code" value={codeQuery} onChange={event => setCodeQuery(event.target.value)} placeholder={c.codePlaceholder} className="w-full rounded-lg border p-3 font-mono text-sm" />{codeLookup.error ? <p role="alert" className="text-xs text-red-600">{codeLookup.error}</p> : codeLookup.rows.length > 0 && <DetailTable rows={codeLookup.rows} c={c} encodings={encodings} />}</div><div className="space-y-3"><label className="text-sm font-medium" htmlFor="unicode-name">{c.lookupName}</label><input id="unicode-name" value={nameQuery} onChange={event => setNameQuery(event.target.value)} placeholder={c.namePlaceholder} className="w-full rounded-lg border p-3 font-mono text-sm" />{nameLookup.length > 0 ? <DetailTable rows={nameLookup} c={c} encodings={encodings} /> : nameQuery && <p className="text-xs text-slate-500">{c.noResults}</p>}</div></div>
    </div></details>
  </div>;
};
