import React, { useMemo, useState, useEffect } from 'react';
import { ArrowRightLeft, Check, Copy, QrCode, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

const clampChannel = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

const rgbToHex = (rgb: { r: number; g: number; b: number }) =>
  `#${[rgb.r, rgb.g, rgb.b].map(channel => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`;

const hslToRgb = (h: number, s: number, l: number) => {
  const normalizedH = (((h % 360) + 360) % 360) / 360;
  const normalizedS = Math.min(100, Math.max(0, s)) / 100;
  const normalizedL = Math.min(100, Math.max(0, l)) / 100;

  if (normalizedS === 0) {
    const value = clampChannel(normalizedL * 255);
    return { r: value, g: value, b: value };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let nextT = t;
    if (nextT < 0) nextT += 1;
    if (nextT > 1) nextT -= 1;
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
    if (nextT < 1 / 2) return q;
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
    return p;
  };

  const q = normalizedL < 0.5
    ? normalizedL * (1 + normalizedS)
    : normalizedL + normalizedS - normalizedL * normalizedS;
  const p = 2 * normalizedL - q;
  return {
    r: clampChannel(hue2rgb(p, q, normalizedH + 1 / 3) * 255),
    g: clampChannel(hue2rgb(p, q, normalizedH) * 255),
    b: clampChannel(hue2rgb(p, q, normalizedH - 1 / 3) * 255),
  };
};

const relativeLuminance = (rgb: { r: number; g: number; b: number }) => {
  const channels = [rgb.r, rgb.g, rgb.b].map(channel => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastRatio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (lighter + 0.05) / (darker + 0.05);
};

const wcagBadge = (ratio: number) => {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA Large';
  return 'Fail';
};

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
    const [customBackground, setCustomBackground] = useState('#ffffff');
    const [alpha, setAlpha] = useState(1);
    const [copied, setCopied] = useState(false);

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
        setHex(rgbToHex(newRgb));
    }

    const applyHsl = (next: { h?: number; s?: number; l?: number }) => {
        const nextHsl = {
            h: next.h ?? hsl.h,
            s: next.s ?? hsl.s,
            l: next.l ?? hsl.l,
        };
        const nextRgb = hslToRgb(nextHsl.h, nextHsl.s, nextHsl.l);
        setRgb(nextRgb);
        setHex(rgbToHex(nextRgb));
    };

    const hsv = useMemo(() => {
        const r = rgb.r / 255;
        const g = rgb.g / 255;
        const b = rgb.b / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        if (d) {
            if (max === r) h = ((g - b) / d) % 6;
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
            if (h < 0) h += 360;
        }
        return {
            h: Math.round(h),
            s: Math.round((max === 0 ? 0 : d / max) * 100),
            v: Math.round(max * 100),
        };
    }, [rgb]);

    const rgbaText = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha.toFixed(2)})`;
    const customBackgroundRgb = useMemo(() => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(customBackground);
        return result
            ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
            : { r: 255, g: 255, b: 255 };
    }, [customBackground]);

    const contrastChecks = useMemo(() => [
        { label: '白底文字', ratio: contrastRatio(rgb, { r: 255, g: 255, b: 255 }), bg: '#ffffff', fg: hex },
        { label: '黑底文字', ratio: contrastRatio(rgb, { r: 0, g: 0, b: 0 }), bg: '#000000', fg: hex },
        { label: '自定义背景', ratio: contrastRatio(rgb, customBackgroundRgb), bg: customBackground, fg: hex },
    ], [customBackground, customBackgroundRgb, hex, rgb]);

    const nearestAccessible = useMemo(() => {
        const candidates = Array.from({ length: 101 }, (_, lightness) => {
            const candidateRgb = hslToRgb(hsl.h, hsl.s, lightness);
            return {
                rgb: candidateRgb,
                lightness,
                ratio: contrastRatio(candidateRgb, customBackgroundRgb),
                distance: Math.abs(lightness - hsl.l),
            };
        }).filter(candidate => candidate.ratio >= 4.5).sort((a, b) => a.distance - b.distance)[0];
        return candidates ? { ...candidates, hex: rgbToHex(candidates.rgb) } : null;
    }, [customBackgroundRgb, hsl]);

    const cssText = `${hex.toUpperCase()}\n${rgbaText}\nhsl(${hsl.h} ${hsl.s}% ${hsl.l}% / ${Math.round(alpha * 100)}%)\nhsv(${hsv.h} ${hsv.s}% ${hsv.v}%)\n--color-accent: ${hex.toUpperCase()};\ntext-[${hex.toUpperCase()}]`;
    const copyCss = async () => {
        await navigator.clipboard.writeText(cssText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader
              title="颜色转换器"
              description="HEX、RGB/RGBA、HSL、HSV 实时互转及预览。"
              actions={<Button size="sm" variant="secondary" onClick={copyCss} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>复制颜色值</Button>}
            />
            <CardContent className="flex-1 overflow-auto space-y-8">
                 <div className="flex flex-col items-center justify-center space-y-4">
                 <div 
                    className="h-32 w-32 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-200 transition-colors duration-300"
                    style={{ backgroundColor: rgbaText }}
                 />
                 <div className="text-center font-mono text-sm text-slate-500">{hex.toUpperCase()} · {rgbaText}</div>
                 </div>
                 
                 <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="tool-panel p-4">
                        <label className="block text-xs uppercase text-slate-500 font-bold mb-2">HEX Color</label>
                        <div className="flex items-center gap-2">
                            <input type="color" value={hex} onChange={e => handleHexChange(e.target.value)} className="h-9 w-10 rounded border border-slate-200 bg-white" />
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
                        <div className="space-y-3 font-mono text-sm text-slate-800">
                            <div>hsl({hsl.h} {hsl.s}% {hsl.l}% / {Math.round(alpha * 100)}%)</div>
                            <label className="block text-xs text-slate-500">H {hsl.h}<input type="range" min="0" max="360" value={hsl.h} onChange={e => applyHsl({ h: Number(e.target.value) })} className="w-full accent-primary-600" /></label>
                            <label className="block text-xs text-slate-500">S {hsl.s}%<input type="range" min="0" max="100" value={hsl.s} onChange={e => applyHsl({ s: Number(e.target.value) })} className="w-full accent-primary-600" /></label>
                            <label className="block text-xs text-slate-500">L {hsl.l}%<input type="range" min="0" max="100" value={hsl.l} onChange={e => applyHsl({ l: Number(e.target.value) })} className="w-full accent-primary-600" /></label>
                        </div>
                    </div>
                    <div className="tool-panel p-4">
                        <label className="block text-xs uppercase text-slate-500 font-bold mb-2">Alpha / HSV</label>
                        <input type="range" min="0" max="1" step="0.01" value={alpha} onChange={e => setAlpha(Number(e.target.value))} className="w-full accent-primary-600" />
                        <div className="mt-3 space-y-1 font-mono text-sm text-slate-800">
                          <div>{rgbaText}</div>
                          <div>hsv({hsv.h} {hsv.s}% {hsv.v}%)</div>
                        </div>
                    </div>
                 </div>

                 <div className="mx-auto grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_18rem]">
                    <div className="tool-panel p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">WCAG 2.1 对比度分析</h3>
                                <p className="text-xs text-slate-500">按普通文本 4.5:1、AAA 7:1 评估。</p>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                自定义背景
                                <input type="color" value={customBackground} onChange={e => setCustomBackground(e.target.value)} className="h-8 w-10 rounded border border-slate-200 bg-white" />
                            </label>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {contrastChecks.map(check => (
                                <div key={check.label} className="rounded-lg border border-slate-200 p-3" style={{ backgroundColor: check.bg, color: check.fg }}>
                                    <div className="text-xs font-bold">{check.label}</div>
                                    <div className="mt-2 text-2xl font-black">{check.ratio.toFixed(2)}:1</div>
                                    <div className="mt-1 inline-flex rounded bg-white/80 px-2 py-0.5 text-xs font-bold text-slate-900">{wcagBadge(check.ratio)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="tool-panel p-4">
                        <h3 className="text-sm font-bold text-slate-800">合规颜色建议</h3>
                        {nearestAccessible ? (
                            <div className="mt-3 space-y-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRgb(nearestAccessible.rgb);
                                        setHex(nearestAccessible.hex);
                                    }}
                                    className="h-16 w-full rounded-lg border border-slate-200 font-mono text-sm font-bold shadow-sm"
                                    style={{ backgroundColor: nearestAccessible.hex, color: customBackground }}
                                >
                                    {nearestAccessible.hex.toUpperCase()}
                                </button>
                                <p className="text-xs text-slate-500">与自定义背景对比 {nearestAccessible.ratio.toFixed(2)}:1，L 调整到 {nearestAccessible.lightness}%。</p>
                            </div>
                        ) : (
                            <p className="mt-3 text-xs text-slate-500">当前色相/饱和度下未找到 AA 普通文本建议，请调整色相或背景。</p>
                        )}
                    </div>
                 </div>
            </CardContent>
        </Card>
    )
}

// --- QR Code Tool ---
export const QrCodeTool: React.FC = () => {
    const [tab, setTab] = useState<'generate' | 'decode'>('generate');
    const [mode, setMode] = useState<'text' | 'wifi' | 'vcard' | 'event'>('text');
    const [text, setText] = useState('https://example.com');
    const [wifi, setWifi] = useState({ ssid: 'MyWifi', password: 'password', encryption: 'WPA' });
    const [vcard, setVcard] = useState({ name: '张三', phone: '13800000000', email: 'hello@example.com' });
    const [event, setEvent] = useState({ title: 'Demo Event', start: '20260428T090000', end: '20260428T100000' });
    const [size, setSize] = useState(200);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [decodedText, setDecodedText] = useState('');
    const [decodeError, setDecodeError] = useState('');

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

    const decodeFile = (file: File) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            if (!context) {
                setDecodeError('当前浏览器无法读取图片像素。');
                URL.revokeObjectURL(url);
                return;
            }
            context.drawImage(image, 0, 0);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
                setDecodedText(code.data);
                setDecodeError('');
            } else {
                setDecodedText('');
                setDecodeError('未识别到二维码，请尝试更清晰的图片。');
            }
            URL.revokeObjectURL(url);
        };
        image.onerror = () => {
            setDecodeError('图片加载失败。');
            URL.revokeObjectURL(url);
        };
        image.src = url;
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title="二维码生成器" description="本地生成文本、WiFi、名片和事件二维码。" />
            <div className="flex gap-1 border-b border-slate-100 px-5">
                <button className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === 'generate' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500'}`} onClick={() => setTab('generate')}>生成</button>
                <button className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === 'decode' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500'}`} onClick={() => setTab('decode')}>解析</button>
            </div>
            {tab === 'generate' ? (
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
            ) : (
            <CardContent className="flex-1 grid gap-6 p-6 md:grid-cols-2">
                <label className="tool-upload flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center">
                    <Upload className="h-10 w-10 text-slate-400" />
                    <div className="text-sm font-medium text-slate-700">上传二维码图片</div>
                    <div className="text-xs text-slate-500">PNG、JPG、WebP 均可，本地 Canvas 解析</div>
                    <input type="file" accept="image/*" className="hidden" onChange={event => event.target.files?.[0] && decodeFile(event.target.files[0])} />
                </label>
                <div className="tool-panel flex min-h-[300px] flex-col gap-3 p-4">
                    <div className="text-sm font-semibold text-slate-700">解析结果</div>
                    {decodeError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{decodeError}</div>}
                    <textarea readOnly className="min-h-0 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm" value={decodedText} placeholder="解析出的文本会显示在这里" />
                    <Button variant="secondary" disabled={!decodedText} onClick={() => navigator.clipboard.writeText(decodedText)}>复制结果</Button>
                </div>
            </CardContent>
            )}
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
