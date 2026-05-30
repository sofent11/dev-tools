import React, { useState, useEffect } from 'react';
import { Globe, Send, Info, AlertTriangle, Plus, Trash2, ShieldCheck, HelpCircle } from 'lucide-react';
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

export const HttpBuilderTool: React.FC = () => {
    const [method, setMethod] = useState('GET');
    const [url, setUrl] = useState('');
    const [headers, setHeaders] = useState('{\n  "Content-Type": "application/json"\n}');
    const [body, setBody] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);

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
            const options: RequestInit = {
                method,
                headers: h,
            };
            if (method !== 'GET' && method !== 'HEAD') {
                options.body = body;
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
                        <Button onClick={sendRequest} disabled={loading} icon={<Send className="w-4 h-4"/>}>
                            发送请求
                        </Button>
                    </div>

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
                            <FieldLabel>Request Body (String / Raw)</FieldLabel>
                            <textarea
                                className="flex-1 w-full p-2.5 border rounded-xl font-mono text-xs bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus:outline-none resize-none leading-relaxed"
                                value={body}
                                onChange={e => setBody(e.target.value)}
                            />
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

                    {/* Response Card */}
                    <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden min-h-[160px]">
                        <div className="bg-slate-50 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                            <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                响应数据 (Response)
                            </span>
                        </div>
                        <textarea
                            readOnly
                            className="flex-1 p-3 bg-slate-950 border-0 outline-none font-mono text-xs text-emerald-400 leading-relaxed resize-none overflow-auto"
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
