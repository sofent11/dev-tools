import React, { useState, useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

// --- Helper for Clipboard ---
const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
};

// --- Case Converter Tool ---
export const CaseConverterTool: React.FC = () => {
  const [input, setInput] = useState('');
  const { copied, copy } = useCopyToClipboard();

  const toCamel = (s: string) => s.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
  const toSnake = (s: string) => s.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
  const toKebab = (s: string) => s.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`).replace(/^-/, '');
  const toPascal = (s: string) => s.replace(/(\w)(\w*)/g, (g0,g1,g2) => g1.toUpperCase() + g2.toLowerCase()).replace(/[-_]/g, '');
  const toUpper = (s: string) => s.toUpperCase();
  const toLower = (s: string) => s.toLowerCase();

  const transformers = [
    { name: 'camelCase', fn: toCamel },
    { name: 'snake_case', fn: toSnake },
    { name: 'kebab-case', fn: toKebab },
    { name: 'PascalCase', fn: toPascal },
    { name: 'UPPERCASE', fn: toUpper },
    { name: 'lowercase', fn: toLower },
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="文本大小写转换" description="在不同命名规范之间转换文本（驼峰、下划线、连字符等）。" />
      <CardContent className="flex-1 overflow-auto space-y-4">
        <textarea
          className="w-full h-32 p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
          placeholder="输入文本..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {transformers.map((t) => (
            <div key={t.name} className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-500 font-medium mb-1">{t.name}</div>
                <div className="text-sm font-mono truncate text-slate-800 h-5">
                  {input ? t.fn(input) : '...'}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => copy(t.fn(input))}
                disabled={!input}
              >
                {copied ? <Check className="w-4 h-4 text-green-600"/> : <Copy className="w-4 h-4"/>}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// --- Text Statistics Tool ---
export const TextStatsTool: React.FC = () => {
  const [input, setInput] = useState('');

  const stats = {
    chars: input.length,
    charsNoSpace: input.replace(/\s/g, '').length,
    words: input.trim() === '' ? 0 : input.trim().split(/\s+/).length,
    lines: input.trim() === '' ? 0 : input.split(/\r\n|\r|\n/).length,
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="文本统计" description="统计字符数、字数、行数等信息。" />
      <CardContent className="flex-1 overflow-auto space-y-6">
         <textarea
          className="w-full h-48 p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
          placeholder="在此粘贴文本..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-xl text-center border border-blue-100">
                <div className="text-2xl font-bold text-blue-700">{stats.chars}</div>
                <div className="text-xs text-blue-500 uppercase font-semibold">字符总数</div>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl text-center border border-emerald-100">
                <div className="text-2xl font-bold text-emerald-700">{stats.charsNoSpace}</div>
                <div className="text-xs text-emerald-500 uppercase font-semibold">非空字符</div>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl text-center border border-amber-100">
                <div className="text-2xl font-bold text-amber-700">{stats.words}</div>
                <div className="text-xs text-amber-500 uppercase font-semibold">单词数</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl text-center border border-purple-100">
                <div className="text-2xl font-bold text-purple-700">{stats.lines}</div>
                <div className="text-xs text-purple-500 uppercase font-semibold">行数</div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Regex Tester Tool ---
export const RegexTool: React.FC = () => {
  const [regexStr, setRegexStr] = useState('');
  const [flags, setFlags] = useState('gm');
  const [testString, setTestString] = useState('');

  // Use useMemo for derived state instead of useEffect + setState
  const { matches, error } = useMemo(() => {
      if (!regexStr) return { matches: [], error: null };
      try {
          const regex = new RegExp(regexStr, flags);
          const found = testString.match(regex);
          return { matches: found ? Array.from(found) : [], error: null };
      } catch {
          return { matches: [], error: "Invalid Regular Expression" };
      }
  }, [regexStr, flags, testString]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="正则表达式测试" description="实时测试 JS 正则表达式匹配结果。" />
      <CardContent className="flex-1 overflow-auto space-y-4">
        <div className="flex gap-2">
            <div className="flex-1 relative">
                 <span className="absolute left-3 top-2.5 text-slate-400 font-mono text-lg">/</span>
                 <input 
                    className="w-full pl-6 pr-2 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="正则表达式 (例如: [a-z]+)"
                    value={regexStr}
                    onChange={e => setRegexStr(e.target.value)}
                 />
                 <span className="absolute right-3 top-2.5 text-slate-400 font-mono text-lg">/</span>
            </div>
            <input 
                className="w-20 px-2 py-2 border border-slate-300 rounded-lg font-mono text-center focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="flags"
                value={flags}
                onChange={e => setFlags(e.target.value)}
            />
        </div>
        
        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[300px]">
            <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-700 mb-1">测试文本</label>
                <textarea 
                    className="flex-1 w-full p-3 border border-slate-200 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-200"
                    value={testString}
                    onChange={e => setTestString(e.target.value)}
                    placeholder="在此输入待匹配的文本..."
                />
            </div>
            <div className="flex flex-col">
                <label className="text-sm font-medium text-slate-700 mb-1 flex justify-between">
                    <span>匹配结果</span>
                    <span className="text-slate-400">{matches.length} 个匹配</span>
                </label>
                <div className="flex-1 w-full p-3 bg-slate-900 text-green-400 font-mono text-sm rounded-lg overflow-y-auto border border-slate-700">
                    {matches.length === 0 ? (
                        <span className="text-slate-600 italic">{'// No matches found'}</span>
                    ) : (
                        <ul className="list-decimal list-inside">
                            {matches.map((m, i) => (
                                <li key={i} className="mb-1 break-all">&quot;{m}&quot;</li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};
