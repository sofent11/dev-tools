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
