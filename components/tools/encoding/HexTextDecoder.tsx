import React, { useMemo, useState } from 'react';
import { useI18n } from '../../../src/i18n';
import { Card, CardContent } from '../../ui/Card';
import { ContentEditor, ContentToolbar } from '../shared/ContentWorkflow';
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
  const [input, setInput] = useState<string>('');
  const [encoding, setEncoding] = useState<HexTextEncoding>('utf-8');

  const result = useMemo(() => {
    try {
      if (!input.trim()) return { text: '', bytes: 0, hex: '', error: '' };
      const decoded = decodeHexText(input, encoding);
      return { text: decoded.text, bytes: decoded.byteLength, hex: Array.from(decoded.bytes, byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' '), error: '' };
    } catch (error) {
      return { text: '', bytes: 0, hex: '', error: (error as Error).message };
    }
  }, [encoding, input]);

  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => { setEncoding('utf-8'); setInput(c.sample); }} onClear={() => setInput('')} status={`${result.bytes.toLocaleString()} ${c.bytes}`}><label className="flex items-center gap-2 text-sm">{c.encoding}<select aria-label={c.encoding} value={encoding} onChange={event => setEncoding(event.target.value as HexTextEncoding)} className="rounded-lg border p-2">{HEX_TEXT_ENCODINGS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label={c.input} value={input} onChange={setInput} placeholder={c.hint} error={result.error ? errorMessage(result.error, c) : ''} /><ContentEditor label={c.output} value={result.text} output placeholder={c.empty} /></div>
    {result.hex && <details className="tool-panel p-3"><summary className="cursor-pointer text-xs text-slate-500">规范化字节序列</summary><pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs">{result.hex}</pre></details>}
  </CardContent></Card>;
};
