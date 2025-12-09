import React, { useState } from 'react';
import {
  Type, AlignLeft, Hash, Fingerprint, Scissors, ArrowRight,
  Copy, Check, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { nanoid } from 'nanoid';

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
  const { copied, copy } = useCopyToClipboard();

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

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="文本处理"
        description="去重、排序、全半角转换、去除空行"
        actions={
            <div className="flex gap-1 flex-wrap justify-end">
                <Button size="sm" variant="secondary" onClick={handleTrim}>Trim Lines</Button>
                <Button size="sm" variant="secondary" onClick={handleDedup}>Dedup</Button>
                <Button size="sm" variant="secondary" onClick={handleSort}>Sort</Button>
                <Button size="sm" variant="secondary" onClick={handleToFullWidth}>全角</Button>
                <Button size="sm" variant="secondary" onClick={handleToHalfWidth}>半角</Button>
            </div>
        }
      />
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        <div className="flex-1 p-4 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-100">
             <textarea
                className="flex-1 w-full p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Paste text here..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
        </div>
        <div className="flex-1 p-4 flex flex-col min-h-0 relative bg-slate-50/50">
             <textarea
                readOnly
                className="flex-1 w-full p-4 font-mono text-sm bg-white border border-slate-200 rounded-lg resize-none focus:outline-none text-slate-600"
                value={output}
                placeholder="Result..."
              />
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-6 right-6 bg-white shadow-sm border border-slate-100"
                onClick={() => copy(output)}
                disabled={!output}
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
        </div>
      </div>
    </Card>
  );
};

// --- Slug Generator ---
export const SlugTool: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const { copied, copy } = useCopyToClipboard();

    const generateSlug = (val: string) => {
        setInput(val);
        const slug = val.toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        setOutput(slug);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="Slug 生成器" description="标题转 URL Slug" />
            <CardContent className="space-y-4">
                <input
                    type="text"
                    className="w-full p-3 border rounded-lg"
                    placeholder="Input title..."
                    value={input}
                    onChange={(e) => generateSlug(e.target.value)}
                />
                <div className="relative">
                    <input
                        readOnly
                        className="w-full p-3 bg-slate-100 border rounded-lg text-slate-600 font-mono"
                        value={output}
                    />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1"
                        onClick={() => copy(output)}
                    >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
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
            <CardHeader title="随机字符串 / ID" description="生成随机字符串或 NanoID" />
            <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                    <label className="text-sm">Length: </label>
                    <input
                        type="number"
                        value={length}
                        onChange={(e) => setLength(parseInt(e.target.value) || 10)}
                        className="w-20 p-2 border rounded"
                    />
                     <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={useNumbers} onChange={(e) => setUseNumbers(e.target.checked)} />
                        Numbers
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={useSpecial} onChange={(e) => setUseSpecial(e.target.checked)} />
                        Special
                    </label>
                </div>

                <div className="flex gap-2">
                     <Button onClick={generate} icon={<Fingerprint className="w-4 h-4"/>}>Generate Random</Button>
                     <Button variant="secondary" onClick={generateNanoId} icon={<Hash className="w-4 h-4"/>}>Generate NanoID</Button>
                </div>

                <div className="relative">
                    <textarea
                        readOnly
                        className="w-full p-4 h-32 bg-slate-100 border rounded-lg text-slate-600 font-mono text-lg break-all"
                        value={output}
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
