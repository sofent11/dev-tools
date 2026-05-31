import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Globe, Send, Info, AlertTriangle, Plus, Trash2, ShieldCheck, Copy, Check, Activity, Play, Pause, Wifi } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { FieldLabel } from '../ui/ToolUi';

// --- HTTP Request Builder (Simplified) ---

interface MockRule {
    id: string;
    path: string;
    status: number;
    body: string;
    delay: number;
}

type RequestBodyMode = 'raw' | 'form-data';

type MockMessageHandler = ((event: MessageEvent) => void) | null;

class MockWebSocket {
    url: string;
    readyState: number = WebSocket.CONNECTING;
    onopen: (() => void) | null = null;
    onmessage: MockMessageHandler = null;
    onerror: (() => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    private timeouts: Array<ReturnType<typeof setTimeout>> = [];

    constructor(url: string) {
        this.url = url;
        this.schedule(() => {
            if (this.readyState !== WebSocket.CONNECTING) return;
            this.readyState = WebSocket.OPEN;
            this.onopen?.();
        }, 400);
    }

    private schedule(callback: () => void, delay: number) {
        const timeout = setTimeout(() => {
            this.timeouts = this.timeouts.filter(item => item !== timeout);
            callback();
        }, delay);
        this.timeouts.push(timeout);
    }

    send(data: string) {
        if (this.readyState !== WebSocket.OPEN) return;

        this.schedule(() => {
            if (this.readyState !== WebSocket.OPEN) return;
            let responseText = `[Mock Server Response to "${data}"]`;
            if (data.toLowerCase().includes('ping') || data.toLowerCase().includes('heartbeat')) {
                responseText = 'pong';
            } else {
                responseText = JSON.stringify({
                    status: 'ok',
                    timestamp: Date.now(),
                    received: data,
                    note: '这是本地 Mock 仿真服务器自动响应。'
                }, null, 2);
            }

            if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { data: responseText }));
            }
        }, 300);
    }

    close() {
        this.timeouts.forEach(timeout => clearTimeout(timeout));
        this.timeouts = [];
        if (this.readyState === WebSocket.CLOSED) return;
        this.readyState = WebSocket.CLOSED;
        if (this.onclose) {
            this.onclose(new CloseEvent('close', { code: 1000, reason: 'Mock connection closed' }));
        }
    }
}

class MockEventSource {
    url: string;
    onmessage: MockMessageHandler = null;
    onerror: (() => void) | null = null;
    listeners: Record<string, Array<(event: MessageEvent) => void>> = {};
    timer: ReturnType<typeof setInterval> | null = null;

    constructor(url: string) {
        this.url = url;
        let count = 0;
        this.timer = setInterval(() => {
            count++;
            const data = JSON.stringify({
                event: 'mock-stream',
                id: count,
                value: `流式数据块 #${count}`,
                timestamp: new Date().toLocaleTimeString(),
                desc: '此消息由本地 SSE 仿真服务器持续推送。'
            }, null, 2);

            if (this.onmessage) {
                this.onmessage(new MessageEvent('message', { data }));
            }

            if (this.listeners.ping) {
                this.listeners.ping.forEach(callback => {
                    callback(new MessageEvent('ping', { data: `[心跳] #${count}` }));
                });
            }
        }, 2000);
    }

    addEventListener(event: string, callback: (event: MessageEvent) => void) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    close() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

const stripMatchingQuotes = (value: string) => {
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }
    return value;
};

const parseFormBodyLines = (input: string) =>
    input
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const separatorIndex = line.indexOf('=');
            if (separatorIndex === -1) {
                return [line, ''] as const;
            }
            return [
                line.slice(0, separatorIndex).trim(),
                line.slice(separatorIndex + 1).trim()
            ] as const;
        })
        .filter(([key]) => key);

const parseCurlCommand = (curlCmd: string) => {
    const cleanCmd = curlCmd.trim().replace(/\\\s*\n/g, ' ');
    let method = 'GET';
    let url = '';
    const parsedHeaders: Record<string, string> = {};
    let body = '';
    const formBodyLines: string[] = [];

    const urlRegex = /(?:https?:\/\/[^\s'"]+)/i;
    const urlMatch = cleanCmd.match(urlRegex);
    if (urlMatch) {
        url = urlMatch[0];
    }

    const tokens: string[] = [];
    let current = '';
    let inDoubleQuotes = false;
    let inSingleQuotes = false;
    for (let i = 0; i < cleanCmd.length; i++) {
        const char = cleanCmd[i];
        if (char === '"' && !inSingleQuotes) {
            inDoubleQuotes = !inDoubleQuotes;
        } else if (char === "'" && !inDoubleQuotes) {
            inSingleQuotes = !inSingleQuotes;
        } else if (char === ' ' && !inDoubleQuotes && !inSingleQuotes) {
            if (current) {
                tokens.push(current);
                current = '';
            }
        } else {
            current += char;
        }
    }
    if (current) tokens.push(current);

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === '-X' || token === '--request' || token.startsWith('--request=')) {
            const nextMethod = token.startsWith('--request=') ? token.slice('--request='.length) : tokens[i + 1];
            method = nextMethod?.toUpperCase() || 'GET';
            if (!token.startsWith('--request=')) i++;
        } else if (token === '-H' || token === '--header' || token.startsWith('--header=')) {
            const headerStr = token.startsWith('--header=') ? token.slice('--header='.length) : (tokens[i + 1] || '');
            const normalizedHeaderStr = stripMatchingQuotes(headerStr);
            const colonIndex = normalizedHeaderStr.indexOf(':');
            if (colonIndex > 0) {
                const key = normalizedHeaderStr.slice(0, colonIndex).trim();
                const value = normalizedHeaderStr.slice(colonIndex + 1).trim();
                parsedHeaders[key] = value;
            }
            if (!token.startsWith('--header=')) i++;
        } else if (
            token === '-d' ||
            token === '--data' ||
            token === '--data-raw' ||
            token === '--data-binary' ||
            token.startsWith('--data=') ||
            token.startsWith('--data-raw=') ||
            token.startsWith('--data-binary=')
        ) {
            const payload = token.includes('=') ? token.slice(token.indexOf('=') + 1) : (tokens[i + 1] || '');
            body = stripMatchingQuotes(payload);
            if (method === 'GET') method = 'POST';
            if (!token.includes('=')) i++;
        } else if (
            token === '-F' ||
            token === '--form' ||
            token === '--form-string' ||
            token.startsWith('--form=') ||
            token.startsWith('--form-string=')
        ) {
            const formToken = token.includes('=') ? token.slice(token.indexOf('=') + 1) : (tokens[i + 1] || '');
            const normalizedFormToken = stripMatchingQuotes(formToken);
            const separatorIndex = normalizedFormToken.indexOf('=');
            if (separatorIndex > 0) {
                const key = normalizedFormToken.slice(0, separatorIndex).trim();
                const value = stripMatchingQuotes(normalizedFormToken.slice(separatorIndex + 1).trim());
                formBodyLines.push(`${key}=${value}`);
            }
            if (method === 'GET') method = 'POST';
            if (!token.includes('=')) i++;
        }
    }

    if (!url) {
        const httpToken = tokens.find(t => t.startsWith('http://') || t.startsWith('https://'));
        if (httpToken) url = httpToken;
    }

    const bodyMode: RequestBodyMode = formBodyLines.length > 0 ? 'form-data' : 'raw';
    if (bodyMode === 'form-data') {
        body = formBodyLines.join('\n');
    }

    return { method, url, headers: JSON.stringify(parsedHeaders, null, 2), body, bodyMode };
};

export const HttpBuilderTool: React.FC = () => {
    const [method, setMethod] = useState('GET');
    const [url, setUrl] = useState('');
    const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
    const [body, setBody] = useState('');
    const [bodyMode, setBodyMode] = useState<RequestBodyMode>('raw');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCurlModal, setShowCurlModal] = useState(false);
    const [curlInput, setCurlInput] = useState('');

    // Code snippet exporter states
    const [resTab, setResTab] = useState<'response' | 'export'>('response');
    const [exportLang, setExportLang] = useState<'fetch' | 'axios' | 'curl' | 'python' | 'go' | 'java'>('fetch');
    const [copiedSnippet, setCopiedSnippet] = useState(false);

    const handleCopySnippet = async (snippet: string) => {
        await navigator.clipboard.writeText(snippet);
        setCopiedSnippet(true);
        setTimeout(() => setCopiedSnippet(false), 1500);
    };

    const handleImportCurl = () => {
        if (!curlInput.trim()) return;
        try {
            const parsed = parseCurlCommand(curlInput);
            setMethod(parsed.method);
            setUrl(parsed.url);
            setHeaders(parsed.headers);
            setBody(parsed.body);
            setBodyMode(parsed.bodyMode);
            setShowCurlModal(false);
            setCurlInput('');
        } catch (e) {
            alert('cURL 解析失败: ' + (e as Error).message);
        }
    };

    const getCodeSnippet = () => {
        let parsedHeaders: Record<string, string> = {};
        try {
            parsedHeaders = JSON.parse(headers || '{}');
        } catch {
            // Ignore JSON parsing errors
        }

        const hasFormBody = method !== 'GET' && method !== 'HEAD' && bodyMode === 'form-data' && body.trim();
        const hasRawBody = method !== 'GET' && method !== 'HEAD' && bodyMode === 'raw' && body;
        const formEntries = hasFormBody ? parseFormBodyLines(body) : [];
        const normalizedHeaders = { ...parsedHeaders };
        delete normalizedHeaders['content-length'];
        if (hasFormBody) {
            delete normalizedHeaders['Content-Type'];
            delete normalizedHeaders['content-type'];
        }
        const targetUrl = url || 'https://api.example.com/data';

        switch (exportLang) {
            case 'fetch': {
                let optsStr = `{\n  method: '${method}',\n`;
                if (Object.keys(normalizedHeaders).length > 0) {
                    optsStr += `  headers: ${JSON.stringify(normalizedHeaders, null, 4).replace(/\n/g, '\n  ')},\n`;
                }
                if (hasFormBody) {
                    optsStr += `  body: formData,\n`;
                } else if (hasRawBody) {
                    optsStr += `  body: JSON.stringify(${body.trim() || '{}'}),\n`;
                }
                if (optsStr.endsWith(',\n')) optsStr = optsStr.slice(0, -2) + '\n';
                optsStr += '}';
                const formPrefix = hasFormBody
                    ? `const formData = new FormData();\n${formEntries.map(([k, v]) => `formData.append(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n')}\n\n`
                    : '';
                return `${formPrefix}fetch('${targetUrl}', ${optsStr})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
            }
            case 'axios': {
                let configStr = `{\n  method: '${method.toLowerCase()}',\n  url: '${targetUrl}',\n`;
                if (Object.keys(normalizedHeaders).length > 0) {
                    configStr += `  headers: ${JSON.stringify(normalizedHeaders, null, 4).replace(/\n/g, '\n  ')},\n`;
                }
                if (hasFormBody) {
                    configStr += `  data: formData,\n`;
                } else if (hasRawBody) {
                    try {
                        const parsedBody = JSON.parse(body);
                        configStr += `  data: ${JSON.stringify(parsedBody, null, 4).replace(/\n/g, '\n  ')},\n`;
                    } catch {
                        configStr += `  data: '${body.replace(/'/g, "\\'")}',\n`;
                    }
                }
                if (configStr.endsWith(',\n')) configStr = configStr.slice(0, -2) + '\n';
                configStr += '}';
                const formPrefix = hasFormBody
                    ? `import axios from 'axios';\n\nconst formData = new FormData();\n${formEntries.map(([k, v]) => `formData.append(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n')}\n\n`
                    : `import axios from 'axios';\n\n`;
                return `${formPrefix}axios(${configStr})\n  .then(res => {\n    console.log(res.data);\n  })\n  .catch(err => {\n    console.error(err);\n  });`;
            }
            case 'curl': {
                let curl = `curl -X ${method} "${targetUrl}"`;
                Object.entries(normalizedHeaders).forEach(([k, v]) => {
                    curl += ` \\\n  -H "${k}: ${v}"`;
                });
                if (hasFormBody) {
                    formEntries.forEach(([k, v]) => {
                        curl += ` \\\n  -F "${k}=${v.replace(/"/g, '\\"')}"`;
                    });
                } else if (hasRawBody) {
                    curl += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
                }
                return curl;
            }
            case 'python': {
                let code = `import requests\nimport json\n\nurl = "${targetUrl}"\n`;
                if (Object.keys(normalizedHeaders).length > 0) {
                    code += `headers = ${JSON.stringify(normalizedHeaders, null, 4)}\n`;
                } else {
                    code += `headers = {}\n`;
                }
                if (hasFormBody) {
                    const formObject = Object.fromEntries(formEntries);
                    code += `data = ${JSON.stringify(formObject, null, 4)}\n`;
                    code += `response = requests.${method.toLowerCase()}(url, headers=headers, data=data)\n`;
                } else if (hasRawBody) {
                    try {
                        const parsedBody = JSON.parse(body);
                        code += `data = ${JSON.stringify(parsedBody, null, 4)}\n`;
                        code += `response = requests.${method.toLowerCase()}(url, headers=headers, json=data)\n`;
                    } catch {
                        code += `data = """${body}"""\n`;
                        code += `response = requests.${method.toLowerCase()}(url, headers=headers, data=data)\n`;
                    }
                } else {
                    code += `response = requests.${method.toLowerCase()}(url, headers=headers)\n`;
                }
                code += `print(response.status_code)\nprint(response.json())`;
                return code;
            }
            case 'go': {
                let headersCode = '';
                Object.entries(normalizedHeaders).forEach(([k, v]) => {
                    headersCode += `\treq.Header.Add("${k}", "${v}")\n`;
                });

                let bodyReader = 'nil';
                let importBody = '';
                let bodyDef = '';
                if (hasFormBody) {
                    importBody = '\n\t"bytes"\n\t"mime/multipart"';
                    bodyDef = `\tvar payload bytes.Buffer\n\twriter := multipart.NewWriter(&payload)\n${formEntries.map(([k, v]) => `\t_ = writer.WriteField(${JSON.stringify(k)}, ${JSON.stringify(v)})\n`).join('')}\twriter.Close()\n`;
                    bodyReader = '&payload';
                    headersCode = `\treq.Header.Set("Content-Type", writer.FormDataContentType())\n${headersCode}`;
                } else if (hasRawBody) {
                    importBody = '\n\t"strings"';
                    bodyDef = `\tpayload := strings.NewReader(\`${body}\`)\n`;
                    bodyReader = 'payload';
                }

                return `package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"net/http"${importBody}\n)\n\nfunc main() {\n\turl := "${targetUrl}"\n${bodyDef}\treq, _ := http.NewRequest("${method}", url, ${bodyReader})\n${headersCode}\n\tclient := &http.Client{}\n\tresp, err := client.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer resp.Body.Close()\n\n\tbody, _ := io.ReadAll(resp.Body)\n\tfmt.Println(resp.Status)\n\tfmt.Println(string(body))\n}`;
            }
            case 'java': {
                let headersCode = '';
                Object.entries(normalizedHeaders).forEach(([k, v]) => {
                    headersCode += `      .addHeader("${k.replace(/"/g, '\\"')}", "${v.replace(/"/g, '\\"')}")\n`;
                });

                let bodyCode = '';
                if (hasFormBody) {
                    bodyCode = `    RequestBody body = new MultipartBody.Builder()\n` +
                               `      .setType(MultipartBody.FORM)\n` +
                               `${formEntries.map(([k, v]) => `      .addFormDataPart("${k.replace(/"/g, '\\"')}", "${v.replace(/"/g, '\\"')}")\n`).join('')}` +
                               `      .build();\n`;
                } else if (hasRawBody) {
                    bodyCode = `    MediaType mediaType = MediaType.parse("${parsedHeaders['Content-Type'] || 'application/json'}");\n` +
                               `    RequestBody body = RequestBody.create(mediaType, "${body.replace(/"/g, '\\"').replace(/\n/g, '\\n')}");\n`;
                } else {
                    bodyCode = `    RequestBody body = null;\n`;
                }

                const reqBodyArg = (method === 'GET' || method === 'HEAD') ? '' : 'body';
                const methodCall = `      .method("${method}", ${reqBodyArg ? 'body' : 'null'})\n`;

                return `import okhttp3.*;\nimport java.io.IOException;\n\npublic class HttpClient {\n  public static void main(String[] args) throws IOException {\n    OkHttpClient client = new OkHttpClient().newBuilder().build();\n${bodyCode}    Request request = new Request.Builder()\n      .url("${targetUrl}")\n${methodCall}${headersCode}      .build();\n    try (Response response = client.newCall(request).execute()) {\n      System.out.println(response.code());\n      System.out.println(response.body().string());\n    }\n  }\n}`;
            }
            default:
                return '';
        }
    };

    // CORS Proxy States
    const [useProxy, setUseProxy] = useState(false);
    const [proxyUrl, setProxyUrl] = useState('https://api.allorigins.win/raw?url=');
    const [showCorsAlert, setShowCorsAlert] = useState(false);

    // Mock API Sandbox States
    const [mockEnabled, setMockEnabled] = useState(false);
    const [mockRules, setMockRules] = useState<MockRule[]>([
        { id: '1', path: '/api/v1/user', status: 200, body: '{\n  "status": "success",\n  "data": {\n    "name": "Antigravity",\n    "role": "AI Architect"\n  }\n}', delay: 200 }
    ]);

    // Active local fetch hijacking for Mock sandbox
    useEffect(() => {
        if (!mockEnabled) return;
        const originalFetch = window.fetch;
        
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            
            // Find matched local Mock rule
            const matched = mockRules.find(rule => rule.path && urlStr.includes(rule.path));
            if (matched) {
                if (matched.delay > 0) {
                    await new Promise(resolve => setTimeout(resolve, matched.delay));
                }
                return new Response(matched.body, {
                    status: matched.status,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            return originalFetch(input, init);
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, [mockEnabled, mockRules]);

    const addMockRule = () => {
        const newRule: MockRule = {
            id: Date.now().toString(),
            path: '/api/v1/custom-endpoint',
            status: 200,
            body: '{\n  "status": "ok"\n}',
            delay: 0
        };
        setMockRules([...mockRules, newRule]);
    };

    const deleteMockRule = (id: string) => {
        setMockRules(mockRules.filter(r => r.id !== id));
    };

    const updateMockRule = (id: string, updates: Partial<MockRule>) => {
        setMockRules(mockRules.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const sendRequest = async () => {
        setLoading(true);
        setResponse('Sending...');
        setShowCorsAlert(false);
        try {
            const h = JSON.parse(headers);
            const normalizedHeaders = { ...h };
            const options: RequestInit = {
                method,
                headers: normalizedHeaders,
            };
            if (method !== 'GET' && method !== 'HEAD') {
                if (bodyMode === 'form-data') {
                    const formData = new FormData();
                    parseFormBodyLines(body).forEach(([key, value]) => {
                        formData.append(key, value);
                    });
                    delete normalizedHeaders['Content-Type'];
                    delete normalizedHeaders['content-type'];
                    delete normalizedHeaders['content-length'];
                    options.body = formData;
                } else {
                    options.body = body;
                }
            }

            // Apply CORS Proxy redirection if checked
            const targetUrl = useProxy ? `${proxyUrl}${encodeURIComponent(url)}` : url;

            const res = await fetch(targetUrl, options);
            const text = await res.text();
            setResponse(`Status: ${res.status} ${res.statusText}\n\n${text}`);
        } catch (e) {
            const errMsg = (e as Error).message;
            setResponse(`Error: ${errMsg}\n\nNote: This tool runs fully locally in your browser.`);
            
            // Auto trigger CORS alert bubble if TypeError occurs without proxy
            if (!useProxy && errMsg.toLowerCase().includes('failed to fetch')) {
                setShowCorsAlert(true);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="HTTP 智能调试与 Mock 沙箱" description="调试本地/公网 API 请求，支持一键 CORS 跨域代理与零后端 Mock 拦截沙箱。" />
            <CardContent className="flex-1 flex flex-col lg:flex-row gap-5 overflow-auto min-h-0">
                
                {/* Left Side: Request Builder & Configurations (7 cols equivalent) */}
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    <div className="flex gap-2">
                        <select
                            className="p-2.5 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-bold focus:outline-none"
                            value={method}
                            onChange={e => setMethod(e.target.value)}
                        >
                            <option>GET</option>
                            <option>POST</option>
                            <option>PUT</option>
                            <option>DELETE</option>
                        </select>
                        <input
                            className="flex-1 p-2.5 border rounded-xl font-mono text-xs border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-200"
                            placeholder="https://api.example.com/data"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                        />
                        <Button onClick={() => setShowCurlModal(true)} variant="secondary">
                            导入 cURL
                        </Button>
                        <Button onClick={sendRequest} disabled={loading} icon={<Send className="w-4 h-4"/>}>
                            发送请求
                        </Button>
                    </div>

                    {showCurlModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                            <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <span className="font-bold text-sm text-slate-800 dark:text-slate-200">导入 cURL 命令行请求</span>
                                    <button onClick={() => setShowCurlModal(false)} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                        关闭
                                    </button>
                                </div>
                                <textarea
                                    className="w-full h-36 p-3 border rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:outline-none resize-none leading-relaxed"
                                    placeholder="例如：curl -X POST 'https://api.example.com/data' -H 'Content-Type: application/json' -d '{&quot;id&quot;: 42}'"
                                    value={curlInput}
                                    onChange={e => setCurlInput(e.target.value)}
                                />
                                <div className="flex gap-2 justify-end">
                                    <Button variant="secondary" onClick={() => setShowCurlModal(false)}>取消</Button>
                                    <Button onClick={handleImportCurl} disabled={!curlInput.trim()}>解析并填充</Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CORS Proxy Configuration Bar */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                        <label className="flex items-center gap-2 font-semibold cursor-pointer">
                            <input 
                                type="checkbox" checked={useProxy} 
                                onChange={e => {
                                    setUseProxy(e.target.checked);
                                    if (e.target.checked) setShowCorsAlert(false);
                                }}
                                className="rounded text-primary-600 focus:ring-primary-400" 
                            />
                            <span>启用 CORS 跨域安全中继代理 (Bypass CORS)</span>
                        </label>
                        {useProxy && (
                            <div className="flex items-center gap-1.5 w-full md:w-auto">
                                <span className="text-slate-400">代理服务器:</span>
                                <select 
                                    value={proxyUrl} 
                                    onChange={e => setProxyUrl(e.target.value)}
                                    className="p-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-md font-mono text-[10px]"
                                >
                                    <option value="https://api.allorigins.win/raw?url=">AllOrigins (免配置)</option>
                                    <option value="https://cors-anywhere.herokuapp.com/">Cors-Anywhere (需激活)</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Automatic CORS failure warning card */}
                    {showCorsAlert && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-start gap-2 font-semibold">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                                <span>请求失败！此错误通常是由于浏览器的同源策略 (CORS) 拦截了跨域请求。</span>
                            </div>
                            <p className="text-rose-600 pl-6 leading-relaxed">
                                由于本百宝箱运行在您的浏览器本地，向没有明确放开 CORS 头的外部 API 发起网络请求会直接被浏览器强行阻断。
                            </p>
                            <div className="pl-6 flex gap-2">
                                <button 
                                    onClick={() => {
                                        setUseProxy(true);
                                        setShowCorsAlert(false);
                                        sendRequest();
                                    }}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg transition-all"
                                >
                                    一键启用跨域中转代理并重发
                                </button>
                                <button 
                                    onClick={() => setShowCorsAlert(false)}
                                    className="border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold px-3 py-1.5 rounded-lg transition-all"
                                >
                                    忽略
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Headers & Body config */}
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                        <div className="flex flex-col gap-1.5 min-h-[120px]">
                            <FieldLabel>Request Headers (JSON)</FieldLabel>
                            <textarea
                                className="flex-1 w-full p-2.5 border rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:outline-none resize-none leading-relaxed"
                                value={headers}
                                onChange={e => setHeaders(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5 min-h-[120px]">
                            <div className="flex items-center justify-between gap-2">
                                <FieldLabel>{bodyMode === 'form-data' ? 'Form Data Body' : 'Request Body (String / Raw)'}</FieldLabel>
                                <select
                                    className="p-1.5 border rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[11px] font-semibold focus:outline-none"
                                    value={bodyMode}
                                    onChange={e => setBodyMode(e.target.value as RequestBodyMode)}
                                >
                                    <option value="raw">Raw Body</option>
                                    <option value="form-data">multipart/form-data</option>
                                </select>
                            </div>
                            <textarea
                                className="flex-1 w-full p-2.5 border rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:outline-none resize-none leading-relaxed"
                                value={body}
                                placeholder={bodyMode === 'form-data' ? 'layout=earring_text\nartifact=dxf\ntext=Mimi' : 'Raw request payload'}
                                onChange={e => setBody(e.target.value)}
                            />
                            {bodyMode === 'form-data' && (
                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                    每行使用 <code>key=value</code>，发送时会自动转换成 <code>multipart/form-data</code>。
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Response View & Local Mock Sandbox (5 cols equivalent) */}
                <div className="w-full lg:w-96 flex flex-col gap-4 min-h-0 shrink-0">
                    
                    {/* Sandbox Control Card */}
                    <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900 dark:to-slate-950/50 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase">本地 Mock 拦截沙箱</h3>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer select-none text-[10px]">
                                <input 
                                    type="checkbox" checked={mockEnabled} 
                                    onChange={e => setMockEnabled(e.target.checked)}
                                    className="sr-only peer" 
                                />
                                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                                <span className="ml-1.5 font-bold text-slate-600 dark:text-slate-400">{mockEnabled ? '启用' : '未开启'}</span>
                            </label>
                        </div>

                        {mockEnabled && (
                            <div className="space-y-3 max-h-[160px] overflow-y-auto pr-1 animate-in fade-in duration-300">
                                {mockRules.map(rule => (
                                    <div key={rule.id} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] space-y-2 relative group shadow-sm">
                                        <div className="flex gap-2">
                                            <input 
                                                className="flex-1 border-b border-dashed border-slate-200 dark:border-slate-800 bg-transparent font-mono focus:outline-none focus:border-primary-500 font-bold"
                                                value={rule.path}
                                                onChange={e => updateMockRule(rule.id, { path: e.target.value })}
                                                placeholder="拦截路径: /api/v1/..."
                                            />
                                            <button 
                                                onClick={() => deleteMockRule(rule.id)}
                                                className="text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-500 font-semibold">
                                            <div className="flex items-center gap-1">
                                                <span>延迟:</span>
                                                <input 
                                                    type="number" className="w-10 border rounded px-1 text-center font-mono"
                                                    value={rule.delay}
                                                    onChange={e => updateMockRule(rule.id, { delay: Number(e.target.value) })}
                                                />
                                                <span>ms</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span>状态:</span>
                                                <input 
                                                    type="number" className="w-10 border rounded px-1 text-center font-mono"
                                                    value={rule.status}
                                                    onChange={e => updateMockRule(rule.id, { status: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-[9px] text-slate-400 block mb-0.5">Mock JSON Response</span>
                                            <textarea 
                                                className="w-full h-12 p-1.5 border border-slate-200 dark:border-slate-800 rounded font-mono text-[9px] resize-none focus:outline-none"
                                                value={rule.body}
                                                onChange={e => updateMockRule(rule.id, { body: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button 
                                    onClick={addMockRule}
                                    className="w-full flex items-center justify-center gap-1.5 py-1.5 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>添加拦截路由</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tabbed Response & Code Gen Card */}
                    <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-h-[220px]">
                        <div className="bg-slate-50 dark:bg-slate-950 px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-none">
                            <div className="flex gap-2">
                                <button 
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${resTab === 'response' ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                    onClick={() => setResTab('response')}
                                >
                                    响应结果
                                </button>
                                <button 
                                    className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${resTab === 'export' ? 'bg-primary-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                    onClick={() => setResTab('export')}
                                >
                                    导出请求代码
                                </button>
                            </div>
                        </div>

                        {resTab === 'response' ? (
                            <textarea
                                readOnly
                                className="flex-1 p-3 bg-slate-950 border-0 outline-none font-mono text-xs text-emerald-400 leading-relaxed resize-none overflow-auto"
                                value={response}
                            />
                        ) : (
                            <div className="flex-1 flex flex-col bg-slate-950 p-3 min-h-0">
                                {/* Language selection buttons */}
                                <div className="flex flex-wrap gap-1.5 mb-2 flex-none">
                                    {(['fetch', 'axios', 'curl', 'python', 'go', 'java'] as const).map(lang => (
                                        <button
                                            key={lang}
                                            onClick={() => setExportLang(lang)}
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                                                exportLang === lang 
                                                    ? 'bg-primary-950 border-primary-800 text-primary-400' 
                                                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {lang.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Snippet output container */}
                                <div className="flex-1 relative min-h-0">
                                    <pre className="w-full h-full p-2.5 rounded-lg border border-slate-900 bg-slate-900/40 font-mono text-[10px] text-slate-300 overflow-auto whitespace-pre leading-relaxed select-all">
                                        {getCodeSnippet()}
                                    </pre>
                                    <button
                                        onClick={() => handleCopySnippet(getCodeSnippet())}
                                        className="absolute top-2 right-2 p-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 transition-all shadow-md hover:bg-slate-800"
                                    >
                                        {copiedSnippet ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </CardContent>
        </Card>
    );
};

// --- User Agent Parser ---
export const UserAgentTool: React.FC = () => {
    const [ua, setUa] = useState(navigator.userAgent);

    return (
        <Card className="h-full flex flex-col">
             <CardHeader title="User Agent 解析" description="查看当前浏览器 UA 或解析自定义 UA" />
             <CardContent className="space-y-4">
                <textarea
                    className="w-full h-24 p-2 border rounded font-mono text-sm"
                    value={ua}
                    onChange={e => setUa(e.target.value)}
                />
                <div className="p-4 bg-slate-50 border rounded-lg space-y-2">
                    {/* Simple parsing demonstration */}
                    <div className="flex justify-between border-b pb-2">
                        <span className="font-semibold">Browser:</span>
                        <span>{/Chrome\/(\d+)/.test(ua) ? 'Chrome ' + ua.match(/Chrome\/(\d+)/)?.[1] : 'Unknown/Other'}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                        <span className="font-semibold">OS:</span>
                        <span>{/Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'MacOS' : /Linux/.test(ua) ? 'Linux' : 'Other'}</span>
                    </div>
                    <div className="flex justify-between">
                          <span className="font-semibold">Mobile:</span>
                          <span>{/Mobile/.test(ua) ? 'Yes' : 'No'}</span>
                    </div>
                </div>
             </CardContent>
        </Card>
    );
}

interface IpInfoData {
    ip: string;
    city?: string;
    region?: string;
    country_name?: string;
    country_code?: string;
    asn?: string;
    org?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    note?: string;
}

// --- IP Info (Dynamic Client-Side Utility) ---
export const IpInfoTool: React.FC = () => {
    const [data, setData] = useState<IpInfoData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchIpInfo = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('https://ipapi.co/json/');
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.reason || 'Failed to fetch IP details');
            setData(json);
        } catch (e) {
            console.error('Failed to fetch from ipapi.co, trying fallback...', e);
            try {
                const res = await fetch('https://api.ipify.org?format=json');
                if (!res.ok) throw new Error(`Fallback HTTP error! status: ${res.status}`);
                const json = await res.json();
                setData({ ip: json.ip, note: '由于拦截插件或跨域限制，仅获取到基本 IP，地理定位不可用。' });
            } catch {
                setError((e as Error).message || 'Failed to retrieve IP information.');
            }
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchIpInfo();
    }, []);

    const handleCopy = () => {
        if (data?.ip) {
            navigator.clipboard.writeText(data.ip);
            alert('IP 地址已复制到剪贴板！');
        }
    };

    return (
        <Card className="h-full flex flex-col">
             <CardHeader title="IP 地址及网络信息" description="纯本地浏览器获取并解析本机公网 IP 及归属地信息" />
             <CardContent className="flex-1 overflow-auto p-6 space-y-6">
                {loading && (
                    <div className="h-48 flex flex-col items-center justify-center space-y-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent"></div>
                        <p className="text-sm text-slate-500 animate-pulse">正在获取本机公网网络信息...</p>
                    </div>
                )}

                {error && !data && (
                    <div className="space-y-4">
                        <div className="p-4 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">
                            <Info className="w-4 h-4 inline mr-2 shrink-0" />
                            无法自动获取您的公网 IP（可能是被广告拦截插件或局域网防火墙阻断）：{error}
                        </div>
                        <Button
                            className="w-full"
                            onClick={() => window.open('https://ipapi.co/json/', '_blank')}
                            icon={<Globe className="w-4 h-4"/>}
                        >
                            在新标签页手动打开查询链接
                        </Button>
                    </div>
                )}

                {data && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Main IP display */}
                        <div className="bg-gradient-to-br from-primary-50 to-primary-100/50 p-6 rounded-xl border border-primary-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">您的公网 IP</span>
                                <h3 className="text-3xl font-mono font-bold text-slate-800 tracking-tight mt-1">{data.ip}</h3>
                                {data.note && <p className="text-xs text-amber-600 mt-1">{data.note}</p>}
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={handleCopy}>复制 IP</Button>
                                <Button size="sm" variant="secondary" onClick={fetchIpInfo} icon={<Globe className="w-4 h-4" />}>刷新</Button>
                            </div>
                        </div>

                        {/* Details grid */}
                        {!data.note && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <span className="text-xs text-slate-400 font-medium">国家 / 地区</span>
                                    <p className="text-sm font-semibold text-slate-700">{data.country_name || '未知'} ({data.country_code || 'N/A'})</p>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <span className="text-xs text-slate-400 font-medium">城市 / 省份</span>
                                    <p className="text-sm font-semibold text-slate-700">{data.city || '未知'} • {data.region || '未知'}</p>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <span className="text-xs text-slate-400 font-medium">网络服务商 (ISP)</span>
                                    <p className="text-sm font-semibold text-slate-700 truncate">{data.org || '未知'} {data.asn ? `(${data.asn})` : ''}</p>
                                </div>
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                                    <span className="text-xs text-slate-400 font-medium">经纬度 / 时区</span>
                                    <p className="text-sm font-semibold text-slate-700">
                                        {data.latitude && data.longitude ? `${data.latitude}, ${data.longitude}` : '未知'} • {data.timezone || '未知'}
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        <div className="text-center">
                            <span className="text-xs text-slate-400">信息由免费公共服务提供 • 仅在浏览器本地获取展示</span>
                        </div>
                    </div>
                )}
             </CardContent>
        </Card>
    );
};

interface PingRecord {
    time: number;
    latency: number;
    status: 'success' | 'error';
}

export const PingAnalyzerTool: React.FC = () => {
    const [target, setTarget] = useState('https://www.cloudflare.com/cdn-cgi/trace');
    const [customUrl, setCustomUrl] = useState('');
    const [intervalMs, setIntervalMs] = useState(1000);
    const [isRunning, setIsRunning] = useState(false);
    const [history, setHistory] = useState<PingRecord[]>([]);
    
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Derive network stats dynamically on every render to fully prevent set-state-in-effect issues
    const successes = history.filter(h => h.status === 'success');
    const total = history.length;
    const lossRate = total > 0 ? Math.round(((total - successes.length) / total) * 100) : 0;

    let avg = 0;
    let min = 0;
    let max = 0;
    let jitter = 0;

    if (successes.length > 0) {
        const latencies = successes.map(h => h.latency);
        const sum = latencies.reduce((a, b) => a + b, 0);
        avg = Math.round(sum / latencies.length);
        min = Math.min(...latencies);
        max = Math.max(...latencies);

        let jitterSum = 0;
        let count = 0;
        for (let i = 1; i < latencies.length; i++) {
            jitterSum += Math.abs(latencies[i] - latencies[i-1]);
            count++;
        }
        jitter = count > 0 ? Math.round(jitterSum / count) : 0;
    }

    const performPing = useCallback(async () => {
        const pingUrl = target === 'custom' ? customUrl : target;
        if (!pingUrl) return;

        const urlWithBuster = `${pingUrl}${pingUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
        const start = performance.now();
        
        try {
            await fetch(urlWithBuster, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(3000) });
            const latency = Math.round(performance.now() - start);
            
            setHistory(prev => {
                const next: PingRecord[] = [...prev, { time: Date.now(), latency, status: 'success' }];
                return next.slice(-30);
            });
        } catch {
            setHistory(prev => {
                const next: PingRecord[] = [...prev, { time: Date.now(), latency: 0, status: 'error' }];
                return next.slice(-30);
            });
        }
    }, [customUrl, target]);

    useEffect(() => {
        if (isRunning) {
            // Defer immediate invocation to bypass set-state-in-effect synchronous rendering error
            Promise.resolve().then(performPing);
            timerRef.current = setInterval(performPing, intervalMs);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isRunning, performPing, intervalMs]);

    const renderChart = () => {
        if (history.length === 0) return null;
        
        const width = 500;
        const height = 150;
        const padding = 20;

        const maxVal = Math.max(...history.map(h => h.latency), 100);
        
        const points = history.map((record, i) => {
            const x = padding + (i * (width - padding * 2)) / Math.max(1, history.length - 1);
            const y = height - padding - (record.status === 'success' ? (record.latency * (height - padding * 2)) / maxVal : 0);
            return { x, y, record };
        });

        const pathD = points.length > 1 
            ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
            : '';

        const areaD = points.length > 1
            ? `${pathD} L ${points[points.length-1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`
            : '';

        return (
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full text-primary-500 overflow-visible">
                <defs>
                    <linearGradient id="pingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(59, 130, 246)" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="rgb(59, 130, 246)" stopOpacity="0.0" />
                    </linearGradient>
                </defs>
                <line x1={padding} y1={padding} x2={width-padding} y2={padding} stroke="#1e293b" strokeDasharray="3,3" />
                <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#1e293b" strokeDasharray="3,3" />
                <line x1={padding} y1={height-padding} x2={width-padding} y2={height-padding} stroke="#334155" />

                <text x={padding + 5} y={padding + 12} fill="#64748b" className="text-[8px] font-mono font-bold">{maxVal}ms</text>
                <text x={padding + 5} y={height/2 + 4} fill="#64748b" className="text-[8px] font-mono font-bold">{Math.round(maxVal/2)}ms</text>

                {areaD && <path d={areaD} fill="url(#pingAreaGrad)" />}
                {pathD && <path d={pathD} fill="none" stroke="rgb(59, 130, 246)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                {points.map((p, idx) => (
                    <g key={idx} className="group/dot cursor-pointer">
                        <circle 
                            cx={p.x} cy={p.y} r={p.record.status === 'success' ? 3.5 : 5}
                            fill={p.record.status === 'success' ? 'rgb(59, 130, 246)' : 'rgb(239, 68, 68)'}
                            className="transition-all hover:scale-150"
                        />
                        <title>
                            {`时间: ${new Date(p.record.time).toLocaleTimeString()}\n延时: ${p.record.status === 'success' ? p.record.latency + 'ms' : '丢包/超时'}`}
                        </title>
                    </g>
                ))}
            </svg>
        );
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="本地网络延迟与抖动 Ping 仪表盘" description="在本地浏览器内通过多节点 HTTP 并发轻量嗅探计算网络时延、波动抖动及丢包比率。" />
            <CardContent className="flex-1 overflow-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-xs">
                    <div className="md:col-span-4 space-y-1.5">
                        <FieldLabel>嗅探节点服务器</FieldLabel>
                        <select
                            value={target}
                            onChange={e => setTarget(e.target.value)}
                            className="w-full p-2 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-semibold"
                        >
                            <option value="https://www.cloudflare.com/cdn-cgi/trace">Cloudflare Global Edge</option>
                            <option value="https://www.baidu.com/favicon.ico">Baidu (中国大陆推荐)</option>
                            <option value="https://github.com/favicon.ico">GitHub Server</option>
                            <option value="https://www.taobao.com/favicon.ico">Taobao Edge</option>
                            <option value="custom">自定义主机 URL</option>
                        </select>
                    </div>

                    {target === 'custom' && (
                        <div className="md:col-span-4 space-y-1.5">
                            <FieldLabel>自定义请求 URL (需支持 HEAD/GET)</FieldLabel>
                            <input
                                value={customUrl}
                                onChange={e => setCustomUrl(e.target.value)}
                                placeholder="https://api.myhost.com/health"
                                className="w-full p-2 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono"
                            />
                        </div>
                    )}

                    <div className="md:col-span-2 space-y-1.5">
                        <FieldLabel>探测采样间隔</FieldLabel>
                        <select
                            value={intervalMs}
                            onChange={e => setIntervalMs(Number(e.target.value))}
                            className="w-full p-2 border rounded-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono"
                        >
                            <option value={500}>500 ms</option>
                            <option value={1000}>1.0 秒</option>
                            <option value={2000}>2.0 秒</option>
                            <option value={5000}>5.0 秒</option>
                        </select>
                    </div>

                    <div className="md:col-span-3 flex gap-2">
                        <button
                            onClick={() => setIsRunning(!isRunning)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl font-bold transition-all shadow active:scale-95 border ${
                                isRunning 
                                    ? 'bg-rose-600 border-rose-500 text-white' 
                                    : 'bg-primary-600 border-primary-500 text-white'
                            }`}
                        >
                            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            <span>{isRunning ? '暂停探测' : '开启探测'}</span>
                        </button>
                        <button
                            onClick={() => setHistory([])}
                            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-500 dark:text-slate-400 font-bold transition-all"
                        >
                            重置
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">实时延迟</span>
                        <p className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-100">
                            {history.length > 0 && history[history.length - 1].status === 'success' 
                                ? `${history[history.length - 1].latency} ms` 
                                : '--'
                            }
                        </p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">平均延时</span>
                        <p className="text-2xl font-mono font-bold text-primary-500">{avg ? `${avg} ms` : '--'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">网络抖动 (Jitter)</span>
                        <p className="text-2xl font-mono font-bold text-amber-500">{jitter ? `${jitter} ms` : '--'}</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">丢包率</span>
                        <p className={`text-2xl font-mono font-bold ${lossRate > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {lossRate}%
                        </p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-center space-y-1 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">极值 (Min/Max)</span>
                        <p className="text-sm font-mono font-bold text-slate-600 dark:text-slate-400 mt-1">
                            {min || max ? `${min} / ${max} ms` : '--'}
                        </p>
                    </div>
                </div>

                <div className="p-5 border border-slate-200 dark:border-slate-800 bg-slate-950 rounded-2xl flex flex-col justify-between min-h-[220px]">
                    <div className="flex justify-between items-center text-xs mb-3">
                        <div className="flex items-center gap-2 font-bold text-slate-300">
                            <Activity className="w-4 h-4 text-primary-500 animate-pulse" />
                            <span>延迟波动实时波形图</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">采集上限: 最近 30 次</span>
                    </div>

                    <div className="flex-1 flex items-center justify-center min-h-[150px]">
                        {history.length > 0 ? (
                            renderChart()
                        ) : (
                            <div className="text-slate-500 text-xs text-center space-y-2 select-none">
                                <Wifi className="w-10 h-10 text-slate-700 mx-auto stroke-1" />
                                <p>开启网络探测以载入实时延迟波形图表</p>
                            </div>
                        )}
                    </div>
                </div>

            </CardContent>
        </Card>
    );
};

// --- WebSocket & SSE Real-time Communication Sandbox ---

interface LogItem {
    id: string;
    time: string;
    type: 'info' | 'send' | 'recv' | 'error' | 'success';
    msg: string;
}

export const WebSocketSseSandboxTool: React.FC = () => {
    const [mode, setMode] = useState<'ws' | 'sse'>('ws');
    const [wsUrl, setWsUrl] = useState('wss://echo.websocket.org');
    const [sseUrl, setSseUrl] = useState('https://html5demos.com/sse-demo.php');
    const [protocols, setProtocols] = useState('');
    const [message, setMessage] = useState('{\n  "message": "Hello DevToolbox Pro!"\n}');
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [useMockServer, setUseMockServer] = useState(false);
    
    // Heartbeat configuration
    const [enableHeartbeat, setEnableHeartbeat] = useState(false);
    const [heartbeatInterval, setHeartbeatInterval] = useState(10); // in seconds
    const [heartbeatText, setHeartbeatText] = useState('ping');

    const wsRef = useRef<WebSocket | null>(null);
    const sseRef = useRef<EventSource | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const consoleEndRef = useRef<HTMLDivElement | null>(null);

    const addLog = (type: LogItem['type'], msg: string) => {
        const timeStr = new Date().toLocaleTimeString();
        setLogs(prev => [
            ...prev,
            { id: Date.now().toString() + Math.random().toString(36).substring(2, 7), time: timeStr, type, msg }
        ].slice(-100)); // cap at 100 logs
    };

    const clearLogs = () => setLogs([]);

    // Auto scroll down console logs
    useEffect(() => {
        if (consoleEndRef.current) {
            consoleEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    // Close connections on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) wsRef.current.close();
            if (sseRef.current) sseRef.current.close();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // Heartbeat timer logic safely deferred
    useEffect(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        if (isConnected && mode === 'ws' && enableHeartbeat && wsRef.current?.readyState === WebSocket.OPEN) {
            timerRef.current = setInterval(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(heartbeatText);
                    addLog('send', `[心跳 Ping] ${heartbeatText}`);
                }
            }, heartbeatInterval * 1000);
        }

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isConnected, mode, enableHeartbeat, heartbeatInterval, heartbeatText]);

    const handleConnectWs = () => {
        if (isConnected) {
            if (wsRef.current) {
                wsRef.current.close();
            }
            return;
        }

        if (useMockServer) {
            try {
                addLog('info', `正在连接本地 Mock WebSocket 仿真服务器 (mock://local-websocket-server)...`);
                const ws = new MockWebSocket('mock://local-websocket-server') as unknown as WebSocket;
                wsRef.current = ws;

                ws.onopen = () => {
                    Promise.resolve().then(() => {
                        setIsConnected(true);
                        addLog('success', `WebSocket 本地 Mock 仿真连接成功 🟢`);
                    });
                };

                ws.onmessage = (event) => {
                    Promise.resolve().then(() => {
                        addLog('recv', `[收到数据] ${event.data}`);
                    });
                };

                ws.onerror = () => {
                    Promise.resolve().then(() => {
                        addLog('error', `WebSocket 本地 Mock 发生错误 ❌`);
                    });
                };

                ws.onclose = () => {
                    Promise.resolve().then(() => {
                        setIsConnected(false);
                        wsRef.current = null;
                        addLog('info', `WebSocket 本地 Mock 仿真连接关闭 🔴`);
                    });
                };
            } catch (e) {
                addLog('error', `初始化本地 Mock WebSocket 失败: ${(e as Error).message}`);
            }
            return;
        }

        try {
            addLog('info', `正在连接 WebSocket: ${wsUrl}...`);
            const protoArgs = protocols ? protocols.split(',').map(s => s.trim()) : undefined;
            const ws = new WebSocket(wsUrl, protoArgs);
            wsRef.current = ws;

            ws.onopen = () => {
                Promise.resolve().then(() => {
                    setIsConnected(true);
                    addLog('success', `WebSocket 连接建立成功 🟢`);
                });
            };

            ws.onmessage = (event) => {
                Promise.resolve().then(() => {
                    addLog('recv', `[收到数据] ${event.data}`);
                });
            };

            ws.onerror = () => {
                Promise.resolve().then(() => {
                    addLog('error', `WebSocket 发生错误 ❌`);
                });
            };

            ws.onclose = (event) => {
                Promise.resolve().then(() => {
                    setIsConnected(false);
                    wsRef.current = null;
                    addLog('info', `WebSocket 连接关闭 (代码: ${event.code}, 原因: ${event.reason || '无'}) 🔴`);
                });
            };

        } catch (e) {
            addLog('error', `初始化 WebSocket 失败: ${(e as Error).message}`);
        }
    };

    const handleSendMsg = () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            addLog('error', `发送失败: WebSocket 未处于连接状态。`);
            return;
        }
        wsRef.current.send(message);
        addLog('send', `[已发送] ${message}`);
    };

    const handleToggleSse = () => {
        if (isConnected) {
            if (sseRef.current) {
                sseRef.current.close();
                sseRef.current = null;
            }
            setIsConnected(false);
            addLog('info', `SSE 监听已断开 🔴`);
            return;
        }

        if (useMockServer) {
            try {
                addLog('info', `正在开启本地 Mock SSE 监听 (mock://local-sse-server)...`);
                
                const sse = new MockEventSource('mock://local-sse-server') as unknown as EventSource;
                sseRef.current = sse;
                setIsConnected(true);
                addLog('success', `本地 Mock SSE 监听建立成功，等待仿真数据推送... 🟢`);

                sse.onmessage = (event) => {
                    Promise.resolve().then(() => {
                        addLog('recv', `[收到事件] ${event.data}`);
                    });
                };

                sse.onerror = () => {
                    Promise.resolve().then(() => {
                        addLog('error', `本地 Mock SSE 监听发生错误`);
                    });
                };

                sse.addEventListener('ping', (event) => {
                    Promise.resolve().then(() => {
                        addLog('recv', `[自定义事件: ping] ${event.data}`);
                    });
                });
            } catch (e) {
                addLog('error', `初始化本地 Mock SSE 失败: ${(e as Error).message}`);
            }
            return;
        }

        try {
            addLog('info', `正在连接 SSE 事件源: ${sseUrl}...`);
            const sse = new EventSource(sseUrl);
            sseRef.current = sse;
            setIsConnected(true);
            addLog('success', `SSE 长连接监听成功，等待服务器推送事件... 🟢`);

            sse.onmessage = (event) => {
                Promise.resolve().then(() => {
                    addLog('recv', `[收到事件] ${event.data}`);
                });
            };

            sse.onerror = () => {
                Promise.resolve().then(() => {
                    addLog('error', `SSE 事件流发生错误或重连中...`);
                });
            };

            // Common custom events support
            sse.addEventListener('ping', (event) => {
                Promise.resolve().then(() => {
                    addLog('recv', `[自定义事件: ping] ${event.data}`);
                });
            });
        } catch (e) {
            addLog('error', `初始化 SSE 事件源失败: ${(e as Error).message}`);
        }
    };

    const getLogBadgeColor = (type: LogItem['type']) => {
        switch (type) {
            case 'send': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            case 'recv': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            case 'error': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
            case 'success': return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader 
                title="WebSocket & SSE 实时双向通信沙箱" 
                description="100% 浏览器离线连接调试，支持 WebSocket 双向数据收发、自定义 Subprotocols、心跳包配置以及 Server-Sent Events (SSE) 流式推送监听。" 
            />
            <CardContent className="flex-1 flex flex-col lg:flex-row gap-5 overflow-auto min-h-0">
                {/* Left Side: Connection & Configuration Panel */}
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex gap-3">
                            <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                <input 
                                    type="radio" name="mode" checked={mode === 'ws'} 
                                    onChange={() => {
                                        if (isConnected) {
                                            if (wsRef.current) wsRef.current.close();
                                            if (sseRef.current) sseRef.current.close();
                                            setIsConnected(false);
                                        }
                                        setMode('ws');
                                        setLogs([]);
                                    }}
                                    className="text-primary-600 focus:ring-primary-400" 
                                />
                                <span>WebSocket 客户端</span>
                            </label>
                            <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                                <input 
                                    type="radio" name="mode" checked={mode === 'sse'} 
                                    onChange={() => {
                                        if (isConnected) {
                                            if (wsRef.current) wsRef.current.close();
                                            if (sseRef.current) sseRef.current.close();
                                            setIsConnected(false);
                                        }
                                        setMode('sse');
                                        setLogs([]);
                                    }}
                                    className="text-primary-600 focus:ring-primary-400" 
                                />
                                <span>SSE (Server-Sent Events)</span>
                            </label>
                        </div>
                        <label className="flex items-center gap-2 font-bold cursor-pointer text-emerald-600 dark:text-emerald-400">
                            <input 
                                type="checkbox" checked={useMockServer} 
                                onChange={e => {
                                    if (isConnected) {
                                        if (wsRef.current) wsRef.current.close();
                                        if (sseRef.current) sseRef.current.close();
                                        setIsConnected(false);
                                    }
                                    setUseMockServer(e.target.checked);
                                }}
                                className="rounded text-emerald-600 focus:ring-emerald-400" 
                            />
                            <span>启用本地 Mock 仿真服务器模式</span>
                        </label>
                    </div>

                    {mode === 'ws' ? (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 p-2.5 border rounded-xl font-mono text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none"
                                    placeholder="wss://echo.websocket.org"
                                    value={wsUrl}
                                    onChange={e => setWsUrl(e.target.value)}
                                    disabled={isConnected}
                                />
                                <Button 
                                    onClick={handleConnectWs} 
                                    className={`${isConnected ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'}`}
                                >
                                    {isConnected ? '断开连接' : '建立连接'}
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel>子协议 (Subprotocols, 逗号分隔)</FieldLabel>
                                    <input
                                        className="p-2 border rounded-xl font-mono text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none"
                                        placeholder="mqtt, soap (可选)"
                                        value={protocols}
                                        onChange={e => setProtocols(e.target.value)}
                                        disabled={isConnected}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel>请求头 (Headers) 提示</FieldLabel>
                                    <div className="p-2 border rounded-xl text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                                        💡 浏览器标准 WebSocket API 处于安全沙箱限制，不支持在握手阶段配置自定义 Headers。如需验证鉴权，请将其置于 URL Query 参数中。
                                    </div>
                                </div>
                            </div>

                            {/* Send Message Area */}
                            <div className="flex flex-col gap-1.5">
                                <FieldLabel>发送消息负荷 (Message Body)</FieldLabel>
                                <textarea
                                    className="w-full h-36 p-2.5 border rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:outline-none resize-none leading-relaxed"
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                />
                                <div className="flex justify-end">
                                    <Button onClick={handleSendMsg} disabled={!isConnected} icon={<Send className="w-3.5 h-3.5" />}>
                                        发送数据帧
                                    </Button>
                                </div>
                            </div>

                            {/* Heartbeat Controls */}
                            <div className="p-3 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                                        <input 
                                            type="checkbox" checked={enableHeartbeat} 
                                            onChange={e => setEnableHeartbeat(e.target.checked)}
                                            className="rounded text-primary-600 focus:ring-primary-400" 
                                        />
                                        <span>开启本地定时心跳保活帧 (Ping Heartbeat)</span>
                                    </label>
                                </div>
                                {enableHeartbeat && (
                                    <div className="grid grid-cols-2 gap-3 text-xs animate-in fade-in duration-200">
                                        <div className="space-y-1">
                                            <span className="text-slate-400">发送间隔 (秒):</span>
                                            <input 
                                                type="number" className="w-full p-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-md font-mono"
                                                value={heartbeatInterval}
                                                onChange={e => setHeartbeatInterval(Math.max(1, Number(e.target.value)))}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-slate-400">心跳帧载荷 (文本):</span>
                                            <input 
                                                className="w-full p-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-md font-mono"
                                                value={heartbeatText}
                                                onChange={e => setHeartbeatText(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input
                                    className="flex-1 p-2.5 border rounded-xl font-mono text-xs border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none"
                                    placeholder="https://html5demos.com/sse-demo.php"
                                    value={sseUrl}
                                    onChange={e => setSseUrl(e.target.value)}
                                    disabled={isConnected}
                                />
                                <Button 
                                    onClick={handleToggleSse} 
                                    className={`${isConnected ? 'bg-rose-600 hover:bg-rose-700' : 'bg-primary-600 hover:bg-primary-700'}`}
                                >
                                    {isConnected ? '停止监听' : '开启监听'}
                                </Button>
                            </div>
                            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs space-y-1">
                                <span className="font-bold">📢 SSE 长连接协议特性:</span>
                                <p className="text-amber-700 leading-relaxed text-[11px]">
                                    Server-Sent Events 属于单向推送网络协议，浏览器通过 `EventSource` 请求建立并持续监听数据流响应。百宝箱已内置了针对 `onmessage` 默认推送事件以及自定义 `ping` 事件的异步捕获机制。
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Log Time-Grid Grid View Console */}
                <div className="w-full lg:w-[480px] flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden min-h-[360px] shrink-0 bg-slate-950">
                    <div className="px-4 py-2.5 border-b border-slate-850 flex justify-between items-center flex-none">
                        <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">长连接事件诊断控制台</span>
                        </div>
                        <button 
                            onClick={clearLogs}
                            className="text-[10px] px-2 py-0.5 border border-slate-800 hover:border-slate-700 rounded text-slate-500 hover:text-slate-300 font-bold transition-all"
                        >
                            清屏
                        </button>
                    </div>

                    <div className="flex-1 p-3 font-mono text-[10px] leading-relaxed overflow-y-auto space-y-2 select-text scrollbar-thin">
                        {logs.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 select-none">
                                <Activity className="w-8 h-8 stroke-1 animate-pulse" />
                                <p>等待网络连接建立以捕获长数据交互帧...</p>
                            </div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="border-b border-slate-900 pb-1.5 animate-in slide-in-from-bottom-1 duration-150">
                                    <div className="flex items-center gap-1.5 mb-1 text-slate-500">
                                        <span className="font-semibold text-slate-600">[{log.time}]</span>
                                        <span className={`px-1.5 py-0.2 rounded border text-[8px] font-bold tracking-wider uppercase ${getLogBadgeColor(log.type)}`}>
                                            {log.type}
                                        </span>
                                    </div>
                                    <pre className="text-slate-300 whitespace-pre-wrap break-all font-mono leading-relaxed pl-1">
                                        {log.msg}
                                    </pre>
                                </div>
                            ))
                        )}
                        <div ref={consoleEndRef}></div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
