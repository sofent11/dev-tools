import React, { useState } from 'react';
import {
  Hash, Fingerprint,
  Copy, Check
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { nanoid } from 'nanoid';
import { ContentEditor, ContentToolbar, ContentOptions } from './shared/ContentWorkflow';

// --- Shared Helper: Copy to Clipboard ---
const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return { copied, copy };
};

// --- String Manipulation Tool ---
// Includes: Trim, Dedup, Sort, Full/Half width
export const StringManipulatorTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const handleTrim = () => {
    setOutput(input.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n'));
  };

  const handleDedup = () => {
    const lines = input.split('\n');
    const unique = Array.from(new Set(lines));
    setOutput(unique.join('\n'));
  };

  const handleSort = () => {
    const lines = input.split('\n');
    lines.sort();
    setOutput(lines.join('\n'));
  };

  const handleToFullWidth = () => {
     let res = "";
     for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        if (code >= 33 && code <= 126) {
           res += String.fromCharCode(code + 65248);
        } else if (code === 32) {
           res += String.fromCharCode(12288);
        } else {
           res += input.charAt(i);
        }
     }
     setOutput(res);
  };

  const handleToHalfWidth = () => {
     let res = "";
     for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i);
        if (code >= 65281 && code <= 65374) {
           res += String.fromCharCode(code - 65248);
        } else if (code === 12288) {
           res += String.fromCharCode(32);
        } else {
           res += input.charAt(i);
        }
     }
     setOutput(res);
  };

  const [operation, setOperation] = useState('trim');
  const operations = [{ id: 'trim', label: '去空白与空行', run: handleTrim }, { id: 'dedup', label: '按行去重', run: handleDedup }, { id: 'sort', label: '按行排序', run: handleSort }, { id: 'full', label: '转为全角', run: handleToFullWidth }, { id: 'half', label: '转为半角', run: handleToHalfWidth }];
  const updateInput = (value: string) => { setInput(value); setOutput(''); };
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
    <ContentToolbar onSample={() => updateInput('  Atelier  \nStudio\nAtelier\n\nDesign')} onClear={() => updateInput('')}>
      <label className="flex items-center gap-2 text-sm">处理方式<select aria-label="处理方式" className="rounded-lg border p-2" value={operation} onChange={event => { setOperation(event.target.value); setOutput(''); }}>{operations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <Button disabled={!input} onClick={() => operations.find(item => item.id === operation)!.run()}>处理文本</Button>
    </ContentToolbar>
    <div className="grid gap-4 lg:grid-cols-2"><ContentEditor label="原始文本" value={input} onChange={updateInput} placeholder="粘贴文本，一行一个条目。" /><ContentEditor label="处理结果" value={output} output placeholder="选择处理方式后生成结果；可以继续叠加处理。" onUseResult={() => updateInput(output)} /></div>
    {output && <p className="text-xs text-slate-500" aria-live="polite">输入 {input.split('\n').length} 行 → 输出 {output.split('\n').length} 行</p>}
  </CardContent></Card>;
};

// --- Slug Generator ---
export const SlugTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [unicode, setUnicode] = useState(false);
  const [base, setBase] = useState('https://example.com/articles/');
  const { copied, copy } = useCopyToClipboard();
  const normalized = input.toLowerCase().trim();
  const output = (unicode ? normalized.replace(/[^\p{L}\p{N}\s_-]/gu, '') : normalized.replace(/[^\w\s-]/g, '')).replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
  return <Card className="flex h-full min-h-0 flex-col"><CardContent className="mx-auto min-h-0 w-full max-w-3xl flex-1 space-y-5 overflow-auto">
    <ContentToolbar onSample={() => setInput('Design Systems: A Practical Guide')} onClear={() => setInput('')} status="实时生成" />
    <label className="block text-sm font-semibold">页面标题<input aria-label="页面标题" className="mt-2 w-full rounded-lg border p-4 text-lg" placeholder="输入文章标题或页面名称" value={input} onChange={event => setInput(event.target.value)} /></label>
    <ContentOptions><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unicode} onChange={event => setUnicode(event.target.checked)} />保留中文与其他 Unicode 字母</label><label className="flex min-w-0 flex-1 flex-col gap-2 text-sm">URL 前缀<input aria-label="URL 前缀" className="rounded-lg border p-2 font-mono text-xs" value={base} onChange={event => setBase(event.target.value)} /></label></ContentOptions>
    <div className="tool-panel space-y-3 p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">生成的 Slug</span><Button size="sm" variant="secondary" onClick={() => copy(output)} disabled={!output}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? '已复制' : '复制结果'}</Button></div><div className="break-all font-mono text-xl text-primary-700">{output || '标题输入后显示结果'}</div><div className="break-all border-t pt-3 font-mono text-xs text-slate-400">{base}{output || 'your-page-slug'}</div></div>
    {input && !output && <p role="status" className="text-sm text-amber-700">没有可用字符；含中文的标题可开启 Unicode 选项。</p>}
  </CardContent></Card>;
};

// --- Random String / Short ID ---
export const RandomStringTool: React.FC = () => {
    const [length, setLength] = useState(16);
    const [output, setOutput] = useState('');
    const [useNumbers, setUseNumbers] = useState(true);
    const [useSpecial, setUseSpecial] = useState(true);
    const { copied, copy } = useCopyToClipboard();

    const generate = () => {
        const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" +
                        (useNumbers ? "0123456789" : "") +
                        (useSpecial ? "!@#$%^&*()_+" : "");
        let res = "";
        for (let i = 0; i < length; i++) {
            res += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        setOutput(res);
    };

    const generateNanoId = () => {
        setOutput(nanoid(length));
    }

    return (
        <Card className="h-full flex flex-col">

            <CardContent className="min-h-0 flex-1 space-y-5 overflow-auto">
                <ContentToolbar onClear={() => setOutput('')} status={output ? `${output.length} 字符` : '配置长度后生成'} />
                <div className="tool-panel flex flex-wrap items-center gap-4 p-4">
                    <label className="text-sm">生成长度</label>
                    <input
                        type="number"
                        aria-label="生成长度"
                        min={1}
                        max={1024}
                        value={length}
                        onChange={(e) => setLength(Math.max(1, Math.min(1024, parseInt(e.target.value) || 1)))}
                        className="w-20 p-2 border rounded"
                    />
                     <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={useNumbers} onChange={(e) => setUseNumbers(e.target.checked)} />
                        包含数字
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={useSpecial} onChange={(e) => setUseSpecial(e.target.checked)} />
                        包含符号
                    </label>
                </div>

                <div className="flex flex-wrap gap-2">
                     <Button onClick={generate} icon={<Fingerprint className="w-4 h-4"/>}>生成随机字符串</Button>
                     <Button variant="secondary" onClick={generateNanoId} icon={<Hash className="w-4 h-4"/>}>生成 NanoID</Button>
                </div>

                <div className="relative">
                    <textarea
                        readOnly
                        className="w-full p-4 h-32 bg-slate-100 border rounded-lg text-slate-600 font-mono text-lg break-all"
                        value={output}
                        aria-label="生成的字符串"
                        placeholder="生成的字符串会显示在这里。"
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copy(output)}
                        disabled={!output}
                    >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
