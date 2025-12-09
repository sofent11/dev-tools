import React, { useState } from 'react';
import { Copy, Check, ArrowRightLeft } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

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

export const StringEscaper: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [mode, setMode] = useState<'html' | 'unicode'>('html');
    const { copied, copy } = useCopyToClipboard();

    const process = (action: 'escape' | 'unescape') => {
        try {
            if (mode === 'html') {
                if (action === 'escape') {
                     const div = document.createElement('div');
                     div.appendChild(document.createTextNode(input));
                     setOutput(div.innerHTML);
                } else {
                     const doc = new DOMParser().parseFromString(input, 'text/html');
                     setOutput(doc.documentElement.textContent || '');
                }
            } else {
                if (action === 'escape') {
                    setOutput(input.split('').map(char => {
                        const code = char.charCodeAt(0);
                        return code > 127 ? '\\u' + code.toString(16).padStart(4, '0') : char;
                    }).join(''));
                } else {
                    setOutput(input.replace(/\\u[\dA-F]{4}/gi, (match) =>
                        String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16))
                    ));
                }
            }
        } catch {
            setOutput('Error processing text');
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader
                title={mode === 'html' ? "HTML 转义/反转义" : "Unicode 转义/反转义"}
                description="在 HTML 实体或 Unicode 编码之间转换。"
                actions={
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                        <button
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'html' ? 'bg-white shadow text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setMode('html')}
                        >
                            HTML
                        </button>
                        <button
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode === 'unicode' ? 'bg-white shadow text-primary-600' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => setMode('unicode')}
                        >
                            Unicode
                        </button>
                    </div>
                }
            />
            <CardContent className="flex-1 overflow-auto space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">输入</label>
                    <textarea
                        className="w-full h-32 p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="输入文本..."
                    />
                </div>
                <div className="flex gap-2 justify-center">
                    <Button onClick={() => process('escape')} icon={<ArrowRightLeft className="w-4 h-4"/>}>转义 (Escape)</Button>
                    <Button variant="secondary" onClick={() => process('unescape')} icon={<ArrowRightLeft className="w-4 h-4"/>}>反转义 (Unescape)</Button>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">输出</label>
                    <div className="relative">
                        <textarea
                            readOnly
                            className="w-full h-32 p-3 font-mono text-sm bg-slate-100 border border-slate-200 rounded-lg focus:outline-none resize-none text-slate-600"
                            value={output}
                        />
                         <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-2 right-2 bg-white/50 backdrop-blur"
                            onClick={() => copy(output)}
                            disabled={!output}
                        >
                            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
