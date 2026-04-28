import React, { useMemo, useState, useEffect } from 'react';
import { ArrowRightLeft, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

// --- PX to REM Tool ---
export const PxRemTool: React.FC = () => {
  const [px, setPx] = useState<number>(16);
  const [root, setRoot] = useState<number>(16);
  const [rem, setRem] = useState<number>(1);

  const handlePxChange = (val: string) => {
    const v = parseFloat(val);
    setPx(v);
    if (!isNaN(v)) setRem(parseFloat((v / root).toFixed(4)));
  };

  const handleRemChange = (val: string) => {
    const v = parseFloat(val);
    setRem(v);
    if (!isNaN(v)) setPx(parseFloat((v * root).toFixed(4)));
  };

  const handleRootChange = (val: string) => {
      const v = parseFloat(val);
      setRoot(v);
      if (!isNaN(v)) setRem(parseFloat((px / v).toFixed(4)));
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="PX / REM 转换器" description="CSS 像素与 REM 单位互转。" />
      <CardContent className="flex-1 flex flex-col items-center justify-center space-y-8">
        <div className="tool-panel w-full max-w-md p-6">
            <div className="mb-6">
                 <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Root Font Size (px)</label>
                 <input 
                    type="number" 
                    value={root} 
                    onChange={e => handleRootChange(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-center font-mono"
                 />
            </div>
            
            <div className="flex items-center gap-4">
                 <div className="flex-1">
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">Pixels (px)</label>
                    <input 
                        type="number" 
                        value={px}
                        onChange={e => handlePxChange(e.target.value)}
                        className="w-full p-4 text-xl border border-primary-200 focus:border-primary-500 ring-2 ring-primary-50 rounded-lg text-center font-mono font-bold text-slate-800 focus:outline-none transition-all"
                    />
                 </div>
                 <ArrowRightLeft className="w-6 h-6 text-slate-400 mt-6" />
                 <div className="flex-1">
                    <label className="block text-xs uppercase text-slate-500 font-bold mb-1">REM</label>
                    <input 
                        type="number" 
                        value={rem}
                        onChange={e => handleRemChange(e.target.value)}
                        className="w-full p-4 text-xl border border-emerald-200 focus:border-emerald-500 ring-2 ring-emerald-50 rounded-lg text-center font-mono font-bold text-slate-800 focus:outline-none transition-all"
                    />
                 </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Color Converter Tool ---
export const ColorConverterTool: React.FC = () => {
    const [hex, setHex] = useState('#3b82f6');
    const [rgb, setRgb] = useState({ r: 59, g: 130, b: 246 });

    const hsl = useMemo(() => {
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r:
                    h = (g - b) / d + (g < b ? 6 : 0);
                    break;
                case g:
                    h = (b - r) / d + 2;
                    break;
                default:
                    h = (r - g) / d + 4;
            }
            h /= 6;
        }
        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100),
        };
    }, [rgb]);

    const handleHexChange = (val: string) => {
        setHex(val);
        // Basic hex parsing
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(val);
        if (result) {
            setRgb({
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            });
        }
    };

    const handleRgbChange = (key: 'r' | 'g' | 'b', val: string) => {
        const num = parseInt(val) || 0;
        const newRgb = { ...rgb, [key]: Math.min(255, Math.max(0, num)) };
        setRgb(newRgb);
        
        const toHex = (c: number) => {
            const hex = c.toString(16);
            return hex.length === 1 ? "0" + hex : hex;
        };
        setHex("#" + toHex(newRgb.r) + toHex(newRgb.g) + toHex(newRgb.b));
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="颜色转换器" description="Hex 与 RGB 格式互转及预览。" />
            <CardContent className="flex-1 flex flex-col items-center justify-center space-y-8">
                 <div 
                    className="h-32 w-32 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-200 transition-colors duration-300"
                    style={{ backgroundColor: hex }}
                 />
                 
                 <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="tool-panel p-4">
                        <label className="block text-xs uppercase text-slate-500 font-bold mb-2">HEX Color</label>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-lg">#</span>
                            <input 
                                value={hex.replace('#', '')}
                                onChange={e => handleHexChange('#' + e.target.value)}
                                className="w-full bg-transparent font-mono text-xl text-slate-800 focus:outline-none uppercase"
                                maxLength={6}
                            />
                        </div>
                    </div>

                    <div className="tool-panel p-4">
                        <label className="block text-xs uppercase text-slate-500 font-bold mb-2">RGB Color</label>
                        <div className="flex gap-2">
                            <input 
                                type="number" 
                                value={rgb.r} 
                                onChange={e => handleRgbChange('r', e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded text-center font-mono" 
                                placeholder="R"
                            />
                            <input 
                                type="number" 
                                value={rgb.g} 
                                onChange={e => handleRgbChange('g', e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded text-center font-mono" 
                                placeholder="G"
                            />
                            <input 
                                type="number" 
                                value={rgb.b} 
                                onChange={e => handleRgbChange('b', e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded text-center font-mono" 
                                placeholder="B"
                            />
                        </div>
                    </div>
                    <div className="tool-panel p-4">
                        <label className="block text-xs uppercase text-slate-500 font-bold mb-2">HSL Color</label>
                        <div className="space-y-2 font-mono text-sm text-slate-800">
                            <div>hsl({hsl.h} {hsl.s}% {hsl.l}%)</div>
                            <div className="text-xs text-slate-500">H {hsl.h} / S {hsl.s}% / L {hsl.l}%</div>
                        </div>
                    </div>
                 </div>
            </CardContent>
        </Card>
    )
}

// --- QR Code Tool ---
export const QrCodeTool: React.FC = () => {
    const [mode, setMode] = useState<'text' | 'wifi' | 'vcard' | 'event'>('text');
    const [text, setText] = useState('https://example.com');
    const [wifi, setWifi] = useState({ ssid: 'MyWifi', password: 'password', encryption: 'WPA' });
    const [vcard, setVcard] = useState({ name: '张三', phone: '13800000000', email: 'hello@example.com' });
    const [event, setEvent] = useState({ title: 'Demo Event', start: '20260428T090000', end: '20260428T100000' });
    const [size, setSize] = useState(200);
    const [qrDataUrl, setQrDataUrl] = useState('');

    const content = useMemo(() => {
        if (mode === 'wifi') return `WIFI:T:${wifi.encryption};S:${wifi.ssid};P:${wifi.password};;`;
        if (mode === 'vcard') return `BEGIN:VCARD\nVERSION:3.0\nFN:${vcard.name}\nTEL:${vcard.phone}\nEMAIL:${vcard.email}\nEND:VCARD`;
        if (mode === 'event') return `BEGIN:VEVENT\nSUMMARY:${event.title}\nDTSTART:${event.start}\nDTEND:${event.end}\nEND:VEVENT`;
        return text;
    }, [event, mode, text, vcard, wifi]);

    useEffect(() => {
        let isActive = true;
        (content
            ? QRCode.toDataURL(content, { width: size, margin: 2, errorCorrectionLevel: 'M' })
            : Promise.resolve('')
        )
            .then(url => {
                if (isActive) setQrDataUrl(url);
            })
            .catch(() => {
                if (isActive) setQrDataUrl('');
            });
        return () => {
            isActive = false;
        };
    }, [content, size]);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="二维码生成器" description="本地生成文本、WiFi、名片和事件二维码。" />
            <CardContent className="flex-1 flex flex-col md:flex-row gap-8 p-6">
                <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {(['text', 'wifi', 'vcard', 'event'] as const).map(item => (
                            <Button key={item} size="sm" variant={mode === item ? 'primary' : 'secondary'} onClick={() => setMode(item)}>
                                {item === 'text' ? '文本' : item === 'wifi' ? 'WiFi' : item === 'vcard' ? '名片' : '事件'}
                            </Button>
                        ))}
                    </div>
                    <div>
                        {mode === 'text' && (
                            <>
                                <label className="block text-sm font-medium text-slate-700 mb-1">内容 (文本 / URL)</label>
                                <textarea
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    className="w-full h-32 p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none"
                                />
                            </>
                        )}
                        {mode === 'wifi' && (
                            <div className="grid gap-3">
                                <input className="p-2 border rounded-lg" placeholder="SSID" value={wifi.ssid} onChange={e => setWifi({ ...wifi, ssid: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder="密码" value={wifi.password} onChange={e => setWifi({ ...wifi, password: e.target.value })} />
                                <select className="p-2 border rounded-lg bg-white" value={wifi.encryption} onChange={e => setWifi({ ...wifi, encryption: e.target.value })}>
                                    <option>WPA</option>
                                    <option>WEP</option>
                                    <option>nopass</option>
                                </select>
                            </div>
                        )}
                        {mode === 'vcard' && (
                            <div className="grid gap-3">
                                <input className="p-2 border rounded-lg" placeholder="姓名" value={vcard.name} onChange={e => setVcard({ ...vcard, name: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder="电话" value={vcard.phone} onChange={e => setVcard({ ...vcard, phone: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder="邮箱" value={vcard.email} onChange={e => setVcard({ ...vcard, email: e.target.value })} />
                            </div>
                        )}
                        {mode === 'event' && (
                            <div className="grid gap-3">
                                <input className="p-2 border rounded-lg" placeholder="标题" value={event.title} onChange={e => setEvent({ ...event, title: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder="开始 YYYYMMDDTHHmmss" value={event.start} onChange={e => setEvent({ ...event, start: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder="结束 YYYYMMDDTHHmmss" value={event.end} onChange={e => setEvent({ ...event, end: e.target.value })} />
                            </div>
                        )}
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">尺寸 ({size}px)</label>
                         <input 
                            type="range" 
                            min="100" 
                            max="500" 
                            step="10"
                            value={size}
                            onChange={e => setSize(Number(e.target.value))}
                            className="w-full accent-primary-600"
                         />
                    </div>
                </div>
                <div className="tool-panel flex min-h-[300px] flex-1 items-center justify-center">
                    {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR Code" className="mix-blend-multiply" />
                    ) : (
                        <div className="text-slate-400 flex flex-col items-center">
                            <QrCode className="w-12 h-12 mb-2 opacity-20"/>
                            <p>输入文本以生成</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

// --- Device Info Tool ---
export const DeviceInfoTool: React.FC = () => {
    // Lazily initialize state to avoid setting it in effect
    const [info, setInfo] = useState<Record<string, string>>(() => {
        // Check if window is defined (for safety, though we are client-side)
        if (typeof window !== 'undefined') {
            return {
                "User Agent": navigator.userAgent,
                "Platform": navigator.platform,
                "Language": navigator.language,
                "Screen Resolution": `${window.screen.width} x ${window.screen.height}`,
                "Window Size": `${window.innerWidth} x ${window.innerHeight}`,
                "Color Depth": `${window.screen.colorDepth}-bit`,
                "Pixel Ratio": `${window.devicePixelRatio}x`,
                "Cookies Enabled": navigator.cookieEnabled ? 'Yes' : 'No',
                "Browser Online": navigator.onLine ? 'Yes' : 'No',
            };
        }
        return {};
    });

    useEffect(() => {
        // Optional: Update on resize if we want "Window Size" to track,
        // but initial requirement is static info.
        // If we want dynamic updates:
        const handleResize = () => {
             setInfo(prev => ({
                 ...prev,
                 "Window Size": `${window.innerWidth} x ${window.innerHeight}`
             }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="设备信息" description="查看当前浏览器和系统环境信息。" />
            <CardContent className="flex-1 overflow-auto">
                <div className="grid grid-cols-1 gap-4">
                    {Object.entries(info).map(([key, value]) => (
                        <div key={key} className="tool-panel flex flex-col justify-between p-4 md:flex-row md:items-center">
                            <span className="text-sm font-semibold text-slate-500 uppercase">{key}</span>
                            <code className="mt-1 md:mt-0 text-sm font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 break-all">
                                {value}
                            </code>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
