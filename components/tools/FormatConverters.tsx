import React, { useState } from 'react';
import { Copy, Check, ArrowRightLeft, FileJson, Link, Binary } from 'lucide-react';
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

// --- JSON Tool ---
export const JsonTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleMinify = () => {
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader 
        title="JSON Formatter" 
        description="Validate, format, and minify JSON data."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={handleMinify} icon={<ArrowRightLeft className="w-4 h-4" />}>Minify</Button>
            <Button size="sm" onClick={handleFormat} icon={<FileJson className="w-4 h-4" />}>Prettify</Button>
          </>
        }
      />
      <CardContent className="flex-1 flex flex-col min-h-0">
        <div className="relative flex-1">
          <textarea
            className={`w-full h-full p-4 font-mono text-sm bg-slate-50 border rounded-lg resize-none focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-primary-200'}`}
            placeholder='Paste your JSON here...'
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button 
            size="sm" 
            variant="ghost"
            className="absolute top-2 right-2 bg-white/80 backdrop-blur"
            onClick={() => copy(input)}
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
             <span className="font-bold">Error:</span> {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// --- Base64 Tool ---
export const Base64Tool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const { copied, copy } = useCopyToClipboard();

  const handleEncode = () => {
    try {
      setOutput(btoa(unescape(encodeURIComponent(input))));
    } catch {
      setOutput("Error: Unable to encode. Ensure valid text.");
    }
  };

  const handleDecode = () => {
    try {
      setOutput(decodeURIComponent(escape(atob(input))));
    } catch {
      setOutput("Error: Invalid Base64 string.");
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="Base64 Converter" description="Encode and decode Base64 strings." />
      <CardContent className="flex-1 overflow-auto space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Input</label>
          <textarea
            className="w-full h-32 p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
            placeholder="Text to encode or Base64 to decode..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={handleEncode} icon={<Binary className="w-4 h-4"/>}>Encode</Button>
          <Button variant="secondary" onClick={handleDecode} icon={<ArrowRightLeft className="w-4 h-4"/>}>Decode</Button>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Output</label>
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
};

// --- URL Tool ---
export const UrlTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const { copied, copy } = useCopyToClipboard();

  const handleEncode = () => setOutput(encodeURIComponent(input));
  const handleDecode = () => setOutput(decodeURIComponent(input));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="URL Encoder/Decoder" description="Encode text to URL-safe format or decode it." />
      <CardContent className="flex-1 overflow-auto space-y-4">
         <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Input</label>
          <textarea
            className="w-full h-32 p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
            placeholder="Enter URL or text..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <div className="flex gap-2 justify-center">
          <Button onClick={handleEncode} icon={<Link className="w-4 h-4"/>}>Encode</Button>
          <Button variant="secondary" onClick={handleDecode} icon={<ArrowRightLeft className="w-4 h-4"/>}>Decode</Button>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Output</label>
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
};
