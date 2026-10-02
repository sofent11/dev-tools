import { buildEventQr, buildWifiQr, escapeCardValue } from './shared/qrPayload';
import { useDraftState } from './shared/useDraftState';
import { translateUi as tr, useLocaleRender } from '../../src/i18n/render';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowRightLeft, Check, Copy, QrCode, Upload } from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { FieldLabel, Input, CodePanel } from '../ui/ToolUi';
import { useCopyToClipboard } from './shared/useCopyToClipboard';

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

const composite = (fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }, alpha: number) => ({ r: fg.r * alpha + bg.r * (1 - alpha), g: fg.g * alpha + bg.g * (1 - alpha), b: fg.b * alpha + bg.b * (1 - alpha) });
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
  useLocaleRender();
  const [px, setPx] = useState('16');
  const [root, setRoot] = useState('16');
  const [rem, setRem] = useState('1');
  const { copied, copy } = useCopyToClipboard();
  const validRoot = Number.isFinite(Number(root)) && Number(root) > 0 && root !== '';
  const handlePxChange = (value: string) => { setPx(value); if (value !== '' && Number.isFinite(Number(value)) && validRoot) setRem(String(Number((Number(value) / Number(root)).toFixed(6)))); };
  const handleRemChange = (value: string) => { setRem(value); if (value !== '' && Number.isFinite(Number(value)) && validRoot) setPx(String(Number((Number(value) * Number(root)).toFixed(6)))); };
  const handleRootChange = (value: string) => { setRoot(value); if (Number(value) > 0 && px !== '') setRem(String(Number((Number(px) / Number(value)).toFixed(6)))); };
  const validValues = px !== '' && rem !== '' && Number.isFinite(Number(px)) && Number.isFinite(Number(rem));
  const css = `font-size: ${rem}rem; /* ${px}px at ${root}px root */`;
  return (
    <Card className="h-full flex flex-col">
      <CardHeader title={tr("PX / REM 转换器")} description={tr("编辑任意一侧，另一侧同步换算；设置页面根字号。")} />
      <CardContent className="flex-1 overflow-auto space-y-5">
        <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
          <section className="tool-panel p-4 space-y-4 self-start">
            <FieldLabel hint={tr("必须大于 0")}>{tr("根字号 (px)")}</FieldLabel>
            <Input type="number" min="0.01" value={root} onChange={event => handleRootChange(event.target.value)} aria-invalid={!validRoot} />
            <div className="flex flex-wrap gap-2">{[10, 16, 18, 20].map(value => <Button key={value} size="sm" variant={root === String(value) ? 'primary' : 'secondary'} onClick={() => handleRootChange(String(value))}>{value}px</Button>)}</div>
            {!validRoot && <p role="alert" className="text-sm text-red-600">{tr("根字号需要大于 0，才能进行换算。")}</p>}
          </section>
          <section className="tool-panel p-5 space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] items-center">
              <div><FieldLabel>{tr("像素 (px)")}</FieldLabel><Input className="h-16 text-2xl font-mono" type="number" value={px} onChange={event => handlePxChange(event.target.value)} /></div>
              <ArrowRightLeft className="h-5 w-5 text-slate-400 mx-auto sm:mt-6" />
              <div><FieldLabel>{tr("相对单位 (rem)")}</FieldLabel><Input className="h-16 text-2xl font-mono" type="number" step="any" value={rem} onChange={event => handleRemChange(event.target.value)} /></div>
            </div>
            <div className="flex flex-wrap gap-2">{[12, 14, 16, 24, 32, 48].map(value => <button type="button" className="rounded border border-slate-200 px-3 py-1.5 text-xs hover:border-primary-500" key={value} onClick={() => handlePxChange(String(value))}>{value}px</button>)}</div>
            <CodePanel>{validRoot && validValues ? css : '—'}</CodePanel>
            <Button size="sm" disabled={!validRoot || !validValues} onClick={() => copy(css)} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{tr("复制 CSS")}</Button>
          </section>
        </div>
      </CardContent>
    </Card>
  );
};

// --- Color Converter Tool ---
export const ColorConverterTool: React.FC = () => {
  useLocaleRender();
    const [hex, setHex] = useState('#3b82f6');
    const [rgb, setRgb] = useState({ r: 59, g: 130, b: 246 });
    const [customBackground, setCustomBackground] = useState('#ffffff');
    const [alpha, setAlpha] = useState(1);
    const { copied, copy } = useCopyToClipboard();

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
        { label: '白底文字', ratio: contrastRatio(composite(rgb, { r: 255, g: 255, b: 255 }, alpha), { r: 255, g: 255, b: 255 }), bg: '#ffffff', fg: hex },
        { label: '黑底文字', ratio: contrastRatio(composite(rgb, { r: 0, g: 0, b: 0 }, alpha), { r: 0, g: 0, b: 0 }), bg: '#000000', fg: hex },
        { label: '自定义背景', ratio: contrastRatio(composite(rgb, customBackgroundRgb, alpha), customBackgroundRgb), bg: customBackground, fg: hex },
    ], [alpha, customBackground, customBackgroundRgb, hex, rgb]);

    const nearestAccessible = useMemo(() => {
        const candidates = Array.from({ length: 101 }, (_, lightness) => {
            const candidateRgb = hslToRgb(hsl.h, hsl.s, lightness);
            return {
                rgb: candidateRgb,
                lightness,
                ratio: contrastRatio(composite(candidateRgb, customBackgroundRgb, alpha), customBackgroundRgb),
                distance: Math.abs(lightness - hsl.l),
            };
        }).filter(candidate => candidate.ratio >= 4.5).sort((a, b) => a.distance - b.distance)[0];
        return candidates ? { ...candidates, hex: rgbToHex(candidates.rgb) } : null;
    }, [alpha, customBackgroundRgb, hsl]);

    const cssText = `${hex.toUpperCase()}\n${rgbaText}\nhsl(${hsl.h} ${hsl.s}% ${hsl.l}% / ${Math.round(alpha * 100)}%)\nhsv(${hsv.h} ${hsv.s}% ${hsv.v}%)\n--color-accent: ${hex.toUpperCase()};\ntext-[${hex.toUpperCase()}]`;
    const copyCss = () => copy(cssText);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader
              title={tr("颜色转换器")}
              description={tr("HEX、RGB/RGBA、HSL、HSV 实时互转及预览。")}
              actions={<Button size="sm" variant="secondary" onClick={copyCss} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{tr("复制颜色值")}</Button>}
            />
            <CardContent className="flex-1 overflow-auto space-y-8">
                 <div className="tool-panel flex flex-col sm:flex-row sm:justify-between items-center gap-4 p-4">
                 <div
                    className="h-20 w-32 shrink-0 rounded-lg border border-slate-200 transition-colors duration-300"
                    style={{ backgroundColor: rgbaText }}
                 />
                 <div className="font-mono text-sm text-slate-500">{hex.toUpperCase()} · {rgbaText}</div>
                 <div className="flex gap-2">{['#173b33', '#d4e35b', '#ee7959', '#efe9da', '#181d23'].map(value => <button key={value} type="button" onClick={() => handleHexChange(value)} aria-label={tr("使用颜色 ") + (value) + ""} title={value} className="h-8 w-8 rounded-full border border-slate-200" style={{ backgroundColor: value }} />)}</div>
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
                                <h3 className="text-sm font-bold text-slate-800">{tr("WCAG 2.1 对比度分析")}</h3>
                                <p className="text-xs text-slate-500">{tr("按普通文本 4.5:1、AAA 7:1 评估。")}</p>
                            </div>
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                {tr("自定义背景")}<input type="color" value={customBackground} onChange={e => setCustomBackground(e.target.value)} className="h-8 w-10 rounded border border-slate-200 bg-white" />
                            </label>
                        </div>
                        <div className="grid gap-3 md:grid-cols-3">
                            {contrastChecks.map(check => (
                                <div key={tr(check.label)} className="rounded-lg border border-slate-200 p-3" style={{ backgroundColor: check.bg, color: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` }}>
                                    <div className="text-xs font-bold">{tr(check.label)}</div>
                                    <div className="mt-2 text-2xl font-black">{check.ratio.toFixed(2)}:1</div>
                                    <div className="mt-1 inline-flex rounded bg-white/80 px-2 py-0.5 text-xs font-bold text-slate-900">{wcagBadge(check.ratio)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="tool-panel p-4">
                        <h3 className="text-sm font-bold text-slate-800">{tr("合规颜色建议")}</h3>
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
                                <p className="text-xs text-slate-500">{tr("与自定义背景对比")}{nearestAccessible.ratio.toFixed(2)}{tr(":1，L 调整到")}{nearestAccessible.lightness}%。</p>
                            </div>
                        ) : (
                            <p className="mt-3 text-xs text-slate-500">{tr("当前色相/饱和度下未找到 AA 普通文本建议，请调整色相或背景。")}</p>
                        )}
                    </div>
                 </div>
            </CardContent>
        </Card>
    )
}

// --- QR Code Tool ---
export const QrCodeTool: React.FC = () => {
  useLocaleRender();
    const [tab, setTab] = useState<'generate' | 'decode'>('generate');
    const [mode, setMode] = useState<'text' | 'wifi' | 'vcard' | 'event'>('text');
    const [text, setText] = useDraftState("components/tools/WebTools.tsx:QrCodeTool:text", 'https://example.com');
    const [wifi, setWifi] = useState({ ssid: 'MyWifi', password: 'password', encryption: 'WPA' });
    const [vcard, setVcard] = useState({ name: '张三', phone: '13800000000', email: 'hello@example.com' });
    const [event, setEvent] = useState({ title: 'Demo Event', start: '20260428T090000', end: '20260428T100000' });
    const [size, setSize] = useState(200);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [decodedText, setDecodedText] = useState('');
    const [decodeError, setDecodeError] = useState('');
    const { copied, copy } = useCopyToClipboard();
    const [generationError, setGenerationError] = useState('');

    const content = useMemo(() => {
        if (mode === 'wifi') return wifi.ssid.trim() ? buildWifiQr(wifi) : '';
        if (mode === 'vcard') return `BEGIN:VCARD\nVERSION:3.0\nFN:${escapeCardValue(vcard.name)}\nTEL:${escapeCardValue(vcard.phone)}\nEMAIL:${escapeCardValue(vcard.email)}\nEND:VCARD`;
        if (mode === 'event') { try { return buildEventQr(event); } catch { return ''; } }
        return text;
    }, [event, mode, text, vcard, wifi]);

    useEffect(() => {
        let isActive = true;
        if (mode === 'event') {
            try { buildEventQr(event); } catch (error) { Promise.resolve().then(() => { if (isActive) { setQrDataUrl(''); setGenerationError(tr((error as Error).message)); } }); return () => { isActive = false; }; }
        }
        (content
            ? QRCode.toDataURL(content, { width: size, margin: 2, errorCorrectionLevel: 'M' })
            : Promise.resolve('')
        )
            .then(url => {
                if (isActive) { setQrDataUrl(url); setGenerationError(''); }
            })
            .catch(() => {
                if (isActive) { setQrDataUrl(''); setGenerationError('内容过长或格式无法编码，请缩短后重试。'); }
            });
        return () => {
            isActive = false;
        };
    }, [content, size, event, mode]);

    const decodeTask = useRef<{ image: HTMLImageElement; url: string } | null>(null);
    useEffect(() => () => {
        if (decodeTask.current) { decodeTask.current.image.onload = null; decodeTask.current.image.onerror = null; URL.revokeObjectURL(decodeTask.current.url); decodeTask.current = null; }
    }, []);
    const decodeFile = (file: File) => {
        setDecodedText(''); setDecodeError('');
        if (decodeTask.current) { decodeTask.current.image.onload = null; decodeTask.current.image.onerror = null; URL.revokeObjectURL(decodeTask.current.url); }
        const url = URL.createObjectURL(file); const image = new Image(); const task = { image, url }; decodeTask.current = task;
        const finish = () => { URL.revokeObjectURL(url); if (decodeTask.current === task) decodeTask.current = null; };
        image.onload = () => {
            if (decodeTask.current !== task) return;
            try {
                const width = image.naturalWidth; const height = image.naturalHeight;
                if (!width || !height || width * height > 16000000) throw new Error(tr('图片需小于 1600 万像素。'));
                const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
                const context = canvas.getContext('2d', { willReadFrequently: true });
                if (!context) throw new Error(tr('当前浏览器无法读取图片像素。'));
                context.drawImage(image, 0, 0);
                const imageData = context.getImageData(0, 0, width, height);
                const code = jsQR(imageData.data, width, height);
                if (!code) throw new Error(tr('未识别到二维码，请尝试更清晰的图片。'));
                setDecodedText(code.data);
            } catch (error) { setDecodeError((error as Error).message); } finally { finish(); }
        };
        image.onerror = () => { if (decodeTask.current === task) setDecodeError(tr('图片加载失败。')); finish(); };
        image.src = url;
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader title={tr("二维码生成器")} description={tr("本地生成文本、WiFi、名片和事件二维码。")} />
            <div className="flex gap-1 border-b border-slate-100 px-5">
                <button className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === 'generate' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500'}`} onClick={() => setTab('generate')}>{tr("生成")}</button>
                <button className={`border-b-2 px-3 py-3 text-sm font-medium ${tab === 'decode' ? 'border-primary-500 text-primary-700' : 'border-transparent text-slate-500'}`} onClick={() => setTab('decode')}>{tr("解析")}</button>
            </div>
            {tab === 'generate' ? (
            <CardContent className="flex-1 grid gap-5 overflow-auto lg:grid-cols-[1fr_24rem]">
                <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        {(['text', 'wifi', 'vcard', 'event'] as const).map(item => (
                            <Button key={item} size="sm" variant={mode === item ? 'primary' : 'secondary'} onClick={() => setMode(item)}>
                                {item === 'text' ? tr('文本') : item === 'wifi' ? 'WiFi' : item === 'vcard' ? tr('名片') : tr('事件')}
                            </Button>
                        ))}
                    </div>
                    <div>
                        {mode === 'text' && (
                            <>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{tr("内容 (文本 / URL)")}</label>
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
                                <input className="p-2 border rounded-lg" placeholder={tr("密码")} value={wifi.password} onChange={e => setWifi({ ...wifi, password: e.target.value })} />
                                <select className="p-2 border rounded-lg bg-white" value={wifi.encryption} onChange={e => setWifi({ ...wifi, encryption: e.target.value })}>
                                    <option>WPA</option>
                                    <option>WEP</option>
                                    <option>nopass</option>
                                </select>
                            </div>
                        )}
                        {mode === 'vcard' && (
                            <div className="grid gap-3">
                                <input className="p-2 border rounded-lg" placeholder={tr("姓名")} value={vcard.name} onChange={e => setVcard({ ...vcard, name: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder={tr("电话")} value={vcard.phone} onChange={e => setVcard({ ...vcard, phone: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder={tr("邮箱")} value={vcard.email} onChange={e => setVcard({ ...vcard, email: e.target.value })} />
                            </div>
                        )}
                        {mode === 'event' && (
                            <div className="grid gap-3">
                                <input className="p-2 border rounded-lg" placeholder={tr("标题")} value={event.title} onChange={e => setEvent({ ...event, title: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder={tr("开始 YYYYMMDDTHHmmss")} value={event.start} onChange={e => setEvent({ ...event, start: e.target.value })} />
                                <input className="p-2 border rounded-lg" placeholder={tr("结束 YYYYMMDDTHHmmss")} value={event.end} onChange={e => setEvent({ ...event, end: e.target.value })} />
                            </div>
                        )}
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-slate-700 mb-1">{tr("尺寸 (")}{size}px)</label>
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
                <div className="tool-panel flex min-h-[300px] flex-col items-center justify-center gap-5 p-5 self-start lg:sticky lg:top-0">
                    {qrDataUrl ? (
                        <><img src={qrDataUrl} alt={tr("二维码预览")} className="max-w-full bg-white rounded-lg" /><a href={qrDataUrl} download="qrcode.png" className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white">{tr("下载 PNG")}</a><span className="text-xs text-slate-500">{size} × {size}px · PNG</span></>
                    ) : (
                        <div className="text-slate-400 flex flex-col items-center">
                            <QrCode className="w-12 h-12 mb-2 opacity-20"/>
                            <p role={generationError ? 'alert' : 'status'}>{generationError || tr('输入文本以生成')}</p>
                        </div>
                    )}
                </div>
            </CardContent>
            ) : (
            <CardContent className="flex-1 grid gap-6 p-6 md:grid-cols-2">
                <label className="tool-upload flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-3 p-6 text-center">
                    <Upload className="h-10 w-10 text-slate-400" />
                    <div className="text-sm font-medium text-slate-700">{tr("上传二维码图片")}</div>
                    <div className="text-xs text-slate-500">{tr("PNG、JPG、WebP 均可，本地 Canvas 解析")}</div>
                    <input type="file" accept="image/*" className="hidden" onChange={event => event.target.files?.[0] && decodeFile(event.target.files[0])} />
                </label>
                <div className="tool-panel flex min-h-[300px] flex-col gap-3 p-4">
                    <div className="text-sm font-semibold text-slate-700">{tr("解析结果")}</div>
                    {decodeError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{decodeError}</div>}
                    <textarea readOnly className="min-h-0 flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm" value={decodedText} placeholder={tr("解析出的文本会显示在这里")} />
                    <Button variant="secondary" disabled={!decodedText} onClick={() => copy(decodedText)}>{copied ? tr('已复制') : tr('复制结果')}</Button>
                </div>
            </CardContent>
            )}
        </Card>
    )
}

// --- Device Info Tool ---
export const DeviceInfoTool: React.FC = () => {
  useLocaleRender();
    const { copied, copy } = useCopyToClipboard();
    // Lazily initialize state to avoid setting it in effect
    const [info, setInfo] = useState<Record<string, string>>((): Record<string, string> => {
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
            <CardHeader title={tr("设备信息")} description={tr("屏幕与浏览器参数，窗口尺寸随调整即时更新。")} actions={<Button size="sm" variant="secondary" onClick={() => copy(JSON.stringify(info, null, 2))} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{tr("复制环境报告")}</Button>} />
            <CardContent className="flex-1 overflow-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {Object.entries(info).map(([key, value]) => (
                        <div key={key} className={`tool-panel flex flex-col justify-between gap-3 p-4 ${key === 'User Agent' ? 'sm:col-span-2 xl:col-span-3' : ''}`}>
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
