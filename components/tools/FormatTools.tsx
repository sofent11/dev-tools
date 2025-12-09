import React, { useState } from 'react';
import {
  FileCode, Database, RefreshCw, FileText, ArrowRightLeft,
  Copy, Check, FileSpreadsheet, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import jsyaml from 'js-yaml';
import Papa from 'papaparse';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import { marked } from 'marked';

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

// --- XML Tool ---
export const XmlTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();

  const handleFormat = () => {
    try {
      const parser = new XMLParser({ removeNsprefix: false, ignoreAttributes: false });
      const obj = parser.parse(input);
      const builder = new XMLBuilder({ format: true, ignoreAttributes: false });
      setOutput(builder.build(obj));
      setError(null);
    } catch (e) {
      setError("Invalid XML: " + (e as Error).message);
    }
  };

  const handleMinify = () => {
    try {
      const parser = new XMLParser({ removeNsprefix: false, ignoreAttributes: false });
      const obj = parser.parse(input);
      const builder = new XMLBuilder({ format: false, ignoreAttributes: false });
      setOutput(builder.build(obj));
      setError(null);
    } catch (e) {
      setError("Invalid XML: " + (e as Error).message);
    }
  };

  const handleToJson = () => {
      try {
        const parser = new XMLParser({ removeNsprefix: false, ignoreAttributes: false });
        const obj = parser.parse(input);
        setOutput(JSON.stringify(obj, null, 2));
        setError(null);
      } catch (e) {
        setError("Invalid XML: " + (e as Error).message);
      }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="XML 工具"
        description="XML 美化、压缩与 JSON 转换"
        actions={
          <>
             <Button size="sm" variant="secondary" onClick={handleToJson} icon={<FileCode className="w-4 h-4"/>}>To JSON</Button>
             <Button size="sm" variant="secondary" onClick={handleMinify} icon={<ArrowRightLeft className="w-4 h-4"/>}>Minify</Button>
             <Button size="sm" onClick={handleFormat} icon={<FileCode className="w-4 h-4"/>}>Format</Button>
          </>
        }
      />
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        <div className="flex-1 p-4 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-100">
             <textarea
                className="flex-1 w-full p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Paste XML here..."
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
      {error && <div className="p-2 bg-red-100 text-red-700 text-sm text-center">{error}</div>}
    </Card>
  );
};

// --- YAML <-> JSON Tool ---
export const YamlTool: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { copied, copy } = useCopyToClipboard();

    const yamlToJson = () => {
        try {
            const obj = jsyaml.load(input);
            setOutput(JSON.stringify(obj, null, 2));
            setError(null);
        } catch (e) {
            setError("Invalid YAML: " + (e as Error).message);
        }
    };

    const jsonToYaml = () => {
        try {
            const obj = JSON.parse(input);
            setOutput(jsyaml.dump(obj));
            setError(null);
        } catch (e) {
            setError("Invalid JSON: " + (e as Error).message);
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader
                title="YAML ↔ JSON"
                description="YAML 与 JSON 互转"
                actions={
                    <>
                        <Button size="sm" variant="secondary" onClick={jsonToYaml} icon={<Database className="w-4 h-4"/>}>JSON → YAML</Button>
                        <Button size="sm" onClick={yamlToJson} icon={<FileCode className="w-4 h-4"/>}>YAML → JSON</Button>
                    </>
                }
            />
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
                <div className="flex-1 p-4 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-100">
                    <textarea
                        className="flex-1 w-full p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-200"
                        placeholder="Paste YAML or JSON here..."
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
             {error && <div className="p-2 bg-red-100 text-red-700 text-sm text-center">{error}</div>}
        </Card>
    );
};

// --- CSV <-> JSON Tool ---
export const CsvTool: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState<string | null>(null);
    const { copied, copy } = useCopyToClipboard();

    const csvToJson = () => {
        try {
            const result = Papa.parse(input, { header: true, skipEmptyLines: true });
            if (result.errors.length > 0) throw new Error(result.errors[0].message);
            setOutput(JSON.stringify(result.data, null, 2));
            setError(null);
        } catch (e) {
            setError("Invalid CSV: " + (e as Error).message);
        }
    };

    const jsonToCsv = () => {
        try {
            const obj = JSON.parse(input);
            const csv = Papa.unparse(obj);
            setOutput(csv);
            setError(null);
        } catch (e) {
            setError("Invalid JSON: " + (e as Error).message);
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader
                title="CSV ↔ JSON"
                description="CSV 与 JSON 互转"
                actions={
                    <>
                        <Button size="sm" variant="secondary" onClick={jsonToCsv} icon={<FileSpreadsheet className="w-4 h-4"/>}>JSON → CSV</Button>
                        <Button size="sm" onClick={csvToJson} icon={<FileCode className="w-4 h-4"/>}>CSV → JSON</Button>
                    </>
                }
            />
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
                <div className="flex-1 p-4 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-100">
                    <textarea
                        className="flex-1 w-full p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-200"
                        placeholder="Paste CSV or JSON here..."
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
             {error && <div className="p-2 bg-red-100 text-red-700 text-sm text-center">{error}</div>}
        </Card>
    );
};


// --- Markdown -> HTML Tool ---
export const MarkdownTool: React.FC = () => {
    const [input, setInput] = useState('# Hello World\n\n- Item 1\n- Item 2');
    const [html, setHtml] = useState('');
    const { copied, copy } = useCopyToClipboard();

    React.useEffect(() => {
        // Simple async wrapper for marked
        const parse = async () => {
            const res = await marked.parse(input);
            setHtml(res);
        }
        parse();
    }, [input]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader
                title="Markdown 预览"
                description="Markdown 转 HTML 实时预览"
            />
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
                <div className="flex-1 p-4 flex flex-col min-h-0 border-b md:border-b-0 md:border-r border-slate-100">
                    <textarea
                        className="flex-1 w-full p-4 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-200"
                        placeholder="Type Markdown..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    />
                </div>
                <div className="flex-1 p-4 flex flex-col min-h-0 relative bg-white overflow-y-auto">
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
                    <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2 bg-white shadow-sm border border-slate-100"
                        onClick={() => copy(html)}
                    >
                        {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                </div>
            </div>
        </Card>
    );
};
