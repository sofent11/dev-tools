import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';

export const UrlParser: React.FC = () => {
    const [input, setInput] = useState('https://www.example.com:8080/path/to/resource?search=query&id=123#section-2');

    const { parsed, params } = useMemo(() => {
        try {
            const url = new URL(input);
            const p: Record<string, string> = {};
            url.searchParams.forEach((value, key) => {
                p[key] = value;
            });
            return {
                parsed: {
                    "Protocol": url.protocol,
                    "Host": url.hostname,
                    "Port": url.port,
                    "Path": url.pathname,
                    "Hash": url.hash,
                    "Origin": url.origin
                },
                params: p
            };
        } catch {
            return { parsed: {}, params: {} };
        }
    }, [input]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="URL 解析器" description="解析 URL 的各个组成部分及查询参数。" />
            <CardContent className="flex-1 overflow-auto space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">URL</label>
                    <input
                        className="w-full p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="https://..."
                    />
                </div>

                {Object.keys(parsed).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                             <h3 className="text-xs font-semibold text-slate-500 uppercase">Components</h3>
                             <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                                {Object.entries(parsed).map(([k, v]) => v && (
                                    <div key={k} className="flex border-b border-slate-100 last:border-0">
                                        <div className="w-24 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold border-r border-slate-200 flex items-center">
                                            {k}
                                        </div>
                                        <div className="flex-1 px-3 py-2 font-mono text-sm text-slate-800 break-all">
                                            {v}
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-slate-500 uppercase">Query Parameters</h3>
                            {Object.keys(params).length > 0 ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                                    {Object.entries(params).map(([k, v]) => (
                                         <div key={k} className="flex border-b border-slate-100 last:border-0">
                                            <div className="w-24 px-3 py-2 bg-slate-100 text-slate-600 text-xs font-bold border-r border-slate-200 flex items-center">
                                                {k}
                                            </div>
                                            <div className="flex-1 px-3 py-2 font-mono text-sm text-slate-800 break-all">
                                                {v}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 text-sm text-slate-400 bg-slate-50 rounded-lg border border-slate-200 italic">
                                    No query parameters
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                        Invalid URL
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
