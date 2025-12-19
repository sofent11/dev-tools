import React, { useState } from 'react';
import { Globe, Send, Info } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

// --- HTTP Request Builder (Simplified) ---
export const HttpBuilderTool: React.FC = () => {
    const [method, setMethod] = useState('GET');
    const [url, setUrl] = useState('');
    const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
    const [body, setBody] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);

    const sendRequest = async () => {
        setLoading(true);
        setResponse('Sending...');
        try {
            const h = JSON.parse(headers);
            const options: RequestInit = {
                method,
                headers: h,
            };
            if (method !== 'GET' && method !== 'HEAD') {
                options.body = body;
            }

            // Note: This will likely be blocked by CORS if hitting external APIs from browser directly
            // A real tool would need a backend proxy. We will just simulate or try fetch.
            // For now, let's warn about CORS.

            const res = await fetch(url, options);
            const text = await res.text();
            setResponse(`Status: ${res.status} ${res.statusText}\n\n${text}`);
        } catch (e) {
            setResponse(`Error: ${(e as Error).message}\n\nNote: This tool runs in your browser. CORS policies may block requests to domains that do not explicitly allow it.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="HTTP 请求构造" description="发送简单的 HTTP 请求 (注意 CORS 限制)" />
            <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
                <div className="flex gap-2">
                    <select
                        className="p-2 border rounded bg-white"
                        value={method}
                        onChange={e => setMethod(e.target.value)}
                    >
                        <option>GET</option>
                        <option>POST</option>
                        <option>PUT</option>
                        <option>DELETE</option>
                    </select>
                    <input
                        className="flex-1 p-2 border rounded"
                        placeholder="https://api.example.com/data"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                    />
                    <Button onClick={sendRequest} disabled={loading} icon={<Send className="w-4 h-4"/>}>Send</Button>
                </div>

                <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
                    <div className="flex-1 flex flex-col gap-2">
                         <label className="text-sm font-bold">Headers (JSON)</label>
                         <textarea
                            className="flex-1 p-2 border rounded font-mono text-sm resize-none"
                            value={headers}
                            onChange={e => setHeaders(e.target.value)}
                         />
                         <label className="text-sm font-bold">Body</label>
                         <textarea
                            className="flex-1 p-2 border rounded font-mono text-sm resize-none"
                            value={body}
                            onChange={e => setBody(e.target.value)}
                         />
                    </div>
                    <div className="flex-1 flex flex-col">
                        <label className="text-sm font-bold mb-2">Response</label>
                        <textarea
                            readOnly
                            className="flex-1 p-2 bg-slate-100 border rounded font-mono text-sm resize-none text-slate-700"
                            value={response}
                        />
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

// --- IP Info (Frontend Only Mock/Link) ---
export const IpInfoTool: React.FC = () => {
    return (
        <Card className="h-full flex flex-col">
             <CardHeader title="IP 地址信息" description="查看本机公网 IP 信息" />
             <CardContent className="space-y-4">
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-200">
                    <Info className="w-4 h-4 inline mr-2" />
                    Due to browser security restrictions, purely client-side tools cannot reliably get your public IP without calling an external API.
                </div>

                <Button
                    className="w-full"
                    onClick={() => window.open('https://ipapi.co/json/', '_blank')}
                    icon={<Globe className="w-4 h-4"/>}
                >
                    View my IP on ipapi.co
                </Button>
             </CardContent>
        </Card>
    );
}
