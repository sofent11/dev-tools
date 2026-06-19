import React, { useMemo, useState } from 'react';
import { AlertCircle, Copy, FileCode, RotateCcw } from 'lucide-react';
import { useI18n } from '../../../src/i18n';
import { decodeHexText, HEX_TEXT_ENCODINGS, type HexTextEncoding } from './hexTextCore';

const copyText = {
  'zh-CN': {
    title: 'Hex 字节转文本',
    input: '十六进制输入',
    output: '解码结果',
    encoding: '字符编码',
    decode: '解码',
    clear: '清空',
    copy: '复制',
    bytes: '字节',
    sample: '48 65 6C 6C 6F 2C 20 E4 B8 96 E7 95 8C',
    hint: '支持空格、0x 前缀、\\x 前缀和常见分隔符。',
    empty: '输入 Hex 字节后会在这里显示文本。',
    illegal: '包含非十六进制字符。',
    odd: 'Hex 长度必须是偶数。',
    failed: '当前字节序列无法用所选编码解码。',
  },
  'en-US': {
    title: 'Hex Bytes to Text',
    input: 'Hex input',
    output: 'Decoded text',
    encoding: 'Character encoding',
    decode: 'Decode',
    clear: 'Clear',
    copy: 'Copy',
    bytes: 'bytes',
    sample: '48 65 6C 6C 6F 2C 20 E4 B8 96 E7 95 8C',
    hint: 'Accepts spaces, 0x prefixes, \\x prefixes, and common separators.',
    empty: 'Decoded text appears here after you enter hex bytes.',
    illegal: 'The input contains non-hex characters.',
    odd: 'Hex input must contain an even number of digits.',
    failed: 'The byte sequence cannot be decoded with the selected encoding.',
  },
} as const;

type HexTextCopy = Record<keyof typeof copyText['zh-CN'], string>;

const errorMessage = (code: string, c: HexTextCopy) => {
  if (code === 'HEX_ILLEGAL_CHARACTER') return c.illegal;
  if (code === 'HEX_ODD_LENGTH') return c.odd;
  return c.failed;
};

export const HexTextDecoder: React.FC = () => {
  const { locale } = useI18n();
  const c: HexTextCopy = copyText[locale];
  const [input, setInput] = useState<string>(c.sample);
  const [encoding, setEncoding] = useState<HexTextEncoding>('utf-8');
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => {
    try {
      if (!input.trim()) return { text: '', bytes: 0, error: '' };
      const decoded = decodeHexText(input, encoding);
      return { text: decoded.text, bytes: decoded.byteLength, error: '' };
    } catch (error) {
      return { text: '', bytes: 0, error: (error as Error).message };
    }
  }, [encoding, input]);

  const handleCopy = async () => {
    if (!result.text) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="tool-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{c.title}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.hint}</p>
          </div>
          <FileCode className="h-5 w-5 text-primary-500" />
        </div>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="hex-text-input">
          {c.input}
        </label>
        <textarea
          id="hex-text-input"
          value={input}
          onChange={event => setInput(event.target.value)}
          className="min-h-56 w-full resize-y rounded-lg border border-slate-200 bg-white p-3 font-mono text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
          spellCheck={false}
        />

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-48 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            {c.encoding}
            <select
              value={encoding}
              onChange={event => setEncoding(event.target.value as HexTextEncoding)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
            >
              {HEX_TEXT_ENCODINGS.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setInput('')}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            <RotateCcw className="h-4 w-4" />
            {c.clear}
          </button>
        </div>
      </section>

      <aside className="tool-panel flex min-h-80 flex-col">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{c.output}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{result.bytes.toLocaleString()} {c.bytes}</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!result.text}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-600 px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Copy className="h-4 w-4" />
            {copied ? 'OK' : c.copy}
          </button>
        </div>

        {result.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
            <span>{errorMessage(result.error, c)}</span>
          </div>
        ) : (
          <pre className="min-h-64 flex-1 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
            {result.text || c.empty}
          </pre>
        )}
      </aside>
    </div>
  );
};
