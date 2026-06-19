import React, { useMemo, useState } from 'react';
import { Binary, FileUp, Search } from 'lucide-react';
import { useI18n } from '../../../src/i18n';
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

const DetailTable: React.FC<{ rows: UnicodeCharacterDetail[]; c: UnicodeCopy }> = ({ rows, c }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
    <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
      <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
        <tr>
          <th className="px-3 py-2 text-left">Char</th>
          <th className="px-3 py-2 text-left">Code</th>
          <th className="px-3 py-2 text-left">{c.name}</th>
          <th className="px-3 py-2 text-left">{c.block}</th>
          <th className="px-3 py-2 text-left">{c.utf8}</th>
          <th className="px-3 py-2 text-left">{c.utf16}</th>
          <th className="px-3 py-2 text-left">{c.utf16le}</th>
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
            <td className="px-3 py-2 font-mono text-xs">{row.utf16Hex}</td>
            <td className="px-3 py-2 font-mono text-xs">{row.utf16LeHex}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const UnicodeInspector: React.FC = () => {
  const { locale } = useI18n();
  const c: UnicodeCopy = copyText[locale];
  const [text, setText] = useState('Hello World 👋 € α 👍');
  const [sequential, setSequential] = useState(false);
  const [nameMap, setNameMap] = useState<UnicodeNameMap>(() => new Map());
  const [codeQuery, setCodeQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const analysis = useMemo(() => analyzeUnicodeText(text, { sequential, nameMap }), [nameMap, sequential, text]);
  const codeLookup = useMemo(() => {
    if (!codeQuery.trim()) return [];
    try {
      return [lookupByCodePoint(codeQuery, nameMap)];
    } catch {
      return [];
    }
  }, [codeQuery, nameMap]);
  const nameLookup = useMemo(() => searchUnicodeNames(nameQuery, nameMap, 20), [nameMap, nameQuery]);

  const handleUnicodeDataFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setNameMap(parseUnicodeDataText(content));
  };

  return (
    <div className="space-y-4">
      <section className="tool-panel space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{c.title}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {nameMap.size.toLocaleString()} {c.dataLoaded}
            </p>
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900">
            <FileUp className="h-4 w-4" />
            {c.loadData}
            <input type="file" accept=".txt" className="sr-only" onChange={handleUnicodeDataFile} />
          </label>
        </div>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="unicode-text">
          {c.text}
        </label>
        <textarea
          id="unicode-text"
          value={text}
          onChange={event => setText(event.target.value)}
          className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input type="checkbox" checked={sequential} onChange={event => setSequential(event.target.checked)} />
          {c.sequential}
        </label>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tool-panel space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="unicode-code">
            <Binary className="h-4 w-4" />
            {c.lookupCode}
          </label>
          <input
            id="unicode-code"
            value={codeQuery}
            onChange={event => setCodeQuery(event.target.value)}
            placeholder={c.codePlaceholder}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          />
          {codeLookup.length ? <DetailTable rows={codeLookup} c={c} /> : <p className="text-sm text-slate-500">{c.noResults}</p>}
        </div>
        <div className="tool-panel space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="unicode-name">
            <Search className="h-4 w-4" />
            {c.lookupName}
          </label>
          <input
            id="unicode-name"
            value={nameQuery}
            onChange={event => setNameQuery(event.target.value)}
            placeholder={c.namePlaceholder}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
          />
          {nameLookup.length ? <DetailTable rows={nameLookup} c={c} /> : <p className="text-sm text-slate-500">{c.noResults}</p>}
        </div>
      </section>

      <section className="tool-panel space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.chars}</h3>
        {analysis.characters.length ? <DetailTable rows={analysis.characters} c={c} /> : <p className="text-sm text-slate-500">{c.noResults}</p>}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="tool-panel">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{c.blocks}</h3>
          <div className="space-y-2">
            {analysis.blocks.map(block => (
              <div key={block.block} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                <span>{block.block}</span>
                <span className="font-mono text-primary-700 dark:text-primary-300">{block.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="tool-panel">
          <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">{c.emoji}</h3>
          <div className="space-y-2">
            {analysis.emojiSequences.length ? analysis.emojiSequences.map(item => (
              <div key={`${item.sequence}-${item.name}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900">
                <div className="text-xl">{item.sequence}</div>
                <div className="font-medium text-slate-900 dark:text-slate-100">{item.name}</div>
                <div className="font-mono text-xs text-slate-500">{item.codePoints}</div>
              </div>
            )) : <p className="text-sm text-slate-500">{c.noResults}</p>}
          </div>
        </div>
      </section>
    </div>
  );
};
