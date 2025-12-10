import React, { useState, useEffect } from 'react';
import { Copy, Check, FileCode, ArrowRight } from 'lucide-react';
import { quicktype, InputData, jsonInputForTargetLanguage, JSONSchemaInput, FetchingJSONSchemaStore } from "quicktype-core";
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

export const JsonToTsTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [language, setLanguage] = useState('typescript');
  const [typeName, setTypeName] = useState('Root');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { copied, copy } = useCopyToClipboard();

  async function runQuicktype(targetLanguage: string, typeName: string, jsonString: string) {
    const jsonInput = jsonInputForTargetLanguage(targetLanguage);
    await jsonInput.addSource({
      name: typeName,
      samples: [jsonString]
    });

    const inputData = new InputData();
    inputData.addInput(jsonInput);

    return await quicktype({
      inputData,
      lang: targetLanguage,
      rendererOptions: {
        "just-types": "true", // For TS, prefer interfaces/types over classes
        "package": "com.quicktype" // For Java
      }
    });
  }

  const handleConvert = async () => {
    if (!input.trim()) {
      setError("Please enter JSON content.");
      return;
    }

    setLoading(true);
    setError(null);
    setOutput('');

    try {
      // Validate JSON first
      try {
        JSON.parse(input);
      } catch (e) {
        throw new Error("Invalid JSON: " + (e as Error).message);
      }

      const result = await runQuicktype(language, typeName, input);
      setOutput(result.lines.join('\n'));
    } catch (e) {
      console.error(e);
      setError((e as Error).message || "Conversion failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="JSON to Code Converter"
        description="Generate TypeScript, Go, Java, C# types from JSON."
      />
      <CardContent className="flex-1 flex flex-col min-h-0 space-y-4">

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Target Language:</label>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="text-sm border border-slate-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-primary-200 focus:outline-none"
                >
                    <option value="typescript">TypeScript</option>
                    <option value="go">Go</option>
                    <option value="java">Java</option>
                    <option value="csharp">C#</option>
                    <option value="python">Python</option>
                    <option value="rust">Rust</option>
                    <option value="swift">Swift</option>
                    <option value="kotlin">Kotlin</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">Root Name:</label>
                <input
                    type="text"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    className="text-sm border border-slate-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-primary-200 focus:outline-none w-32"
                />
            </div>

            <Button onClick={handleConvert} disabled={loading} icon={<ArrowRight className="w-4 h-4"/>}>
                {loading ? 'Converting...' : 'Convert'}
            </Button>
        </div>

        {/* Editors */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          {/* Input */}
          <div className="flex-1 flex flex-col min-h-0">
             <label className="text-sm font-medium text-slate-700 mb-1">Input JSON</label>
             <textarea
                className={`w-full h-full p-4 font-mono text-sm bg-slate-50 border rounded-lg resize-none focus:outline-none focus:ring-2 ${error ? 'border-red-300 focus:ring-red-200' : 'border-slate-200 focus:ring-primary-200'}`}
                placeholder='Paste your JSON here...'
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
          </div>

          {/* Output */}
          <div className="flex-1 flex flex-col min-h-0 relative">
             <label className="text-sm font-medium text-slate-700 mb-1">Output Code</label>
             <textarea
                readOnly
                className="w-full h-full p-4 font-mono text-sm bg-slate-900 text-slate-50 border border-slate-700 rounded-lg resize-none focus:outline-none"
                placeholder='Result will appear here...'
                value={output}
              />
               <Button
                size="sm"
                variant="ghost"
                className="absolute top-8 right-2 bg-white/10 text-white hover:bg-white/20 backdrop-blur"
                onClick={() => copy(output)}
                disabled={!output}
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 flex items-start gap-2">
             <span className="font-bold">Error:</span> {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
