import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, Palette, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Textarea } from '../../ui/ToolUi';
import { downloadBlob, readFileAsDataUrl } from '../shared/fileUtils';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';
import { useScratchpadStore } from '../shared/scratchpadStore';
import { notifyToast } from '../shared/notifyToast';
import { FileDropzone, WorkflowEmpty, WorkflowNotice } from '../shared/WorkflowUi';

const readImageDataUrl = async (file: File) => {
  if (file.size > 16 * 1024 * 1024) throw new Error('图片文件上限为 16 MB。');
  const url = await readFileAsDataUrl(file);
  await loadImage(url);
  return url;
};

interface Swatch {
  hex: string;
  count: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface PaletteEntry {
  color: RgbColor;
  hex: string;
  count: number;
}

interface BeadPatternResult {
  size: number;
  palette: PaletteEntry[];
  matrix: number[][];
}

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map(value => value.toString(16).padStart(2, '0')).join('')}`;

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => image.naturalWidth * image.naturalHeight > 20_000_000 ? reject(new Error('图片像素上限为 2000 万，请先缩小图片。')) : resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });

const getPalette = async (src: string): Promise<Swatch[]> => {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  const maxSide = 160;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const buckets = new Map<string, number>();

  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 80) continue;
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;
    const hex = rgbToHex(Math.min(r, 255), Math.min(g, 255), Math.min(b, 255));
    buckets.set(hex, (buckets.get(hex) || 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);



const getSquareSamplePixels = async (src: string, size: number) => {
  const image = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('当前浏览器无法创建 Canvas。');
  }

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const sourceSize = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.max(0, (sourceWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (sourceHeight - sourceSize) / 2);

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

  const { data } = context.getImageData(0, 0, size, size);
  const pixels: RgbColor[] = [];

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;
    pixels.push({
      r: Math.round(data[index] * alpha + 255 * (1 - alpha)),
      g: Math.round(data[index + 1] * alpha + 255 * (1 - alpha)),
      b: Math.round(data[index + 2] * alpha + 255 * (1 - alpha)),
    });
  }

  return pixels;
};


const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
};

const drawDimensionLine = (
  context: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  label: string,
  vertical = false,
) => {
  context.save();
  context.strokeStyle = '#123f91';
  context.fillStyle = '#123f91';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(fromX, fromY);
  context.lineTo(toX, toY);
  context.stroke();

  const tick = 16;
  if (vertical) {
    context.beginPath();
    context.moveTo(fromX - tick / 2, fromY);
    context.lineTo(fromX + tick / 2, fromY);
    context.moveTo(toX - tick / 2, toY);
    context.lineTo(toX + tick / 2, toY);
    context.stroke();
    context.translate(fromX, (fromY + toY) / 2);
    context.rotate(-Math.PI / 2);
    context.font = '700 28px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, 0, -12);
  } else {
    context.beginPath();
    context.moveTo(fromX, fromY - tick / 2);
    context.lineTo(fromX, fromY + tick / 2);
    context.moveTo(toX, toY - tick / 2);
    context.lineTo(toX, toY + tick / 2);
    context.stroke();
    context.font = '700 28px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, (fromX + toX) / 2, fromY - 2);
  }

  context.restore();
};

const getGridMarkers = (size: number) => {
  const markers = new Set([1, size]);
  for (let value = 5; value <= size; value += 5) {
    markers.add(value);
  }
  return Array.from(markers).sort((a, b) => a - b);
};

const drawBeadChart = (canvas: HTMLCanvasElement, result: BeadPatternResult) => {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器无法绘制 Canvas。');
  }

  const cellSize = clampNumber(Math.floor(860 / result.size), 8, 20);
  const gridSize = cellSize * result.size;
  const panelWidth = 260;
  const gap = 54;
  const gridX = panelWidth + gap;
  const gridY = 112;
  const rightMargin = 94;
  const bottomMargin = 86;
  const width = gridX + gridSize + rightMargin;
  const height = Math.max(gridY + gridSize + bottomMargin, 960);

  canvas.width = width;
  canvas.height = height;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);

  context.strokeStyle = '#123f91';
  context.lineWidth = 3;
  drawRoundedRect(context, 18, 18, panelWidth - 26, height - 36, 14);
  context.stroke();

  context.fillStyle = '#123f91';
  context.font = '700 24px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('◆ 色板 / 图例 ◆', panelWidth / 2, 72);

  const metaHeight = 126;
  const paletteTop = 120;
  const paletteBottom = height - metaHeight - 42;
  const rowHeight = clampNumber(Math.floor((paletteBottom - paletteTop) / Math.max(result.palette.length, 1)), 32, 76);
  const swatchSize = clampNumber(rowHeight - 14, 22, 54);

  result.palette.forEach((entry, index) => {
    const y = paletteTop + index * rowHeight;
    const swatchX = 42;
    const swatchY = y + Math.max(5, (rowHeight - swatchSize) / 2);

    context.fillStyle = entry.hex;
    drawRoundedRect(context, swatchX, swatchY, swatchSize, swatchSize, 5);
    context.fill();
    context.strokeStyle = '#1f2937';
    context.lineWidth = 1.5;
    context.stroke();

    context.fillStyle = '#0f172a';
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    context.font = rowHeight < 42 ? '700 15px sans-serif' : '700 22px sans-serif';
    context.fillText(`#${String(index + 1).padStart(2, '0')}`, swatchX + swatchSize + 18, swatchY + swatchSize * 0.48);
    context.font = rowHeight < 42 ? '500 11px sans-serif' : '500 16px sans-serif';
    context.fillText(`${entry.hex.toUpperCase()} · ${entry.count} 颗`, swatchX + swatchSize + 18, swatchY + swatchSize * 0.84);
  });

  const metaX = 30;
  const metaY = height - metaHeight - 28;
  context.setLineDash([8, 7]);
  context.strokeStyle = '#123f91';
  context.lineWidth = 2;
  drawRoundedRect(context, metaX, metaY, panelWidth - 50, metaHeight, 12);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = '#123f91';
  context.font = '700 16px sans-serif';
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillText(`图案尺寸： ${result.size} x ${result.size}`, metaX + 16, metaY + 36);
  context.fillText('拼豆直径： 5mm', metaX + 16, metaY + 70);
  context.fillText('建议底板： 方形拼豆板', metaX + 16, metaY + 104);

  drawDimensionLine(context, gridX + 12, 56, gridX + gridSize - 12, 56, String(result.size));
  drawDimensionLine(context, gridX + gridSize + 44, gridY, gridX + gridSize + 44, gridY + gridSize, String(result.size), true);

  const markers = getGridMarkers(result.size);
  context.fillStyle = '#123f91';
  context.font = '700 16px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  markers.forEach(marker => {
    const position = gridX + (marker - 0.5) * cellSize;
    context.fillText(String(marker), position, gridY - 18);
    context.fillText(String(marker), position, gridY + gridSize + 20);
  });
  context.textAlign = 'right';
  markers.forEach(marker => {
    const position = gridY + (marker - 0.5) * cellSize;
    context.fillText(String(marker), gridX - 16, position);
  });

  result.matrix.forEach((row, rowIndex) => {
    row.forEach((paletteIndex, columnIndex) => {
      const entry = result.palette[paletteIndex];
      context.fillStyle = entry?.hex || '#ffffff';
      context.fillRect(gridX + columnIndex * cellSize, gridY + rowIndex * cellSize, cellSize, cellSize);
    });
  });

  context.strokeStyle = '#71717a';
  context.lineWidth = 1;
  for (let index = 0; index <= result.size; index += 1) {
    const position = gridX + index * cellSize + 0.5;
    context.beginPath();
    context.moveTo(position, gridY);
    context.lineTo(position, gridY + gridSize);
    context.stroke();
  }
  for (let index = 0; index <= result.size; index += 1) {
    const position = gridY + index * cellSize + 0.5;
    context.beginPath();
    context.moveTo(gridX, position);
    context.lineTo(gridX + gridSize, position);
    context.stroke();
  }

  context.strokeStyle = '#1f2937';
  context.lineWidth = 2;
  context.strokeRect(gridX, gridY, gridSize, gridSize);
};

export const ImageColorExtractTool: React.FC = () => {
  useLocaleRender();
  const [imageUrl, setImageUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [colors, setColors] = useState<Swatch[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<'hex' | 'css'>('hex');
  const { copied, copy } = useCopyToClipboard();
  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(''); setColors([]); setFileName(file.name);
    try { const url = await readImageDataUrl(file); setImageUrl(url); setColors(await getPalette(url)); }
    catch (err) { setError(err instanceof Error ? err.message : '无法读取图片'); }
    finally { setBusy(false); }
  };
  const colorText = useMemo(() => colors.map((color, index) => format === 'css' ? `--color-${index + 1}: ${color.hex};` : color.hex).join('\n'), [colors, format]);
  const total = colors.reduce((sum, color) => sum + color.count, 0);
  return (
    <Card className="h-full flex flex-col">
      <CardHeader title={tr("图片颜色提取")} description={tr("从图片中采样色板。点击色块复制颜色，或导出 CSS 变量。")} />
      <CardContent className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
        <section className="flex min-h-0 flex-col gap-4"><FileDropzone accept="image/*" fileName={fileName} disabled={busy} onFiles={files => handleFile(files[0])} title={tr("选择图片或拖到这里")} />{error && <WorkflowNotice tone="error">{error}</WorkflowNotice>}{imageUrl ? <div className="workflow-preview flex items-center justify-center p-4"><img src={imageUrl} alt={tr("待提取图片")} className="max-h-96 max-w-full object-contain" /></div> : <WorkflowEmpty title={tr("从图片开始配色")} description={tr("选择参考图，右侧会显示采样色板。")} icon={<Palette className="h-6 w-6" />} />}</section>
        <section className="flex min-h-0 flex-col gap-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="workflow-segmented"><button aria-pressed={format === 'hex'} onClick={() => setFormat('hex')}>HEX</button><button aria-pressed={format === 'css'} onClick={() => setFormat('css')}>{tr("CSS 变量")}</button></div><Button size="sm" onClick={() => copy(colorText)} disabled={!colors.length} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{tr("复制色板")}</Button></div>{busy && <WorkflowNotice>{tr("正在采样...")}</WorkflowNotice>}{colors.length ? <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{colors.map(color => (<button key={color.hex} type="button" title={tr("点击复制颜色")} className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left" onClick={() => copy(color.hex)}><div className="h-24" style={{ backgroundColor: color.hex }} /><div className="flex items-center justify-between gap-2 p-3"><code className="text-xs">{color.hex}</code><span className="text-[10px] text-slate-500">{Math.round(color.count / total * 100)}%</span></div></button>))}</div><pre className="code-surface overflow-auto p-4 text-xs" data-i18n-skip>{colorText}</pre><p className="text-xs text-slate-500">{tr("比例为当前采样色板中的相对占比。")}</p></> : !busy && <WorkflowEmpty title={tr("色板结果")} description={tr("点击任意色块即可复制 HEX 值。")} />}</section>
      </CardContent>
    </Card>
  );
};

export const ImageToBase64Tool: React.FC = () => {
  useLocaleRender();
  const [dataUrl, setDataUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'url' | 'base64' | 'html' | 'css'>('url');
  const [stashed, setStashed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const output = !dataUrl ? '' : mode === 'base64' ? dataUrl.slice(dataUrl.indexOf(',') + 1) : mode === 'html' ? `<img src="${dataUrl}" alt="" />` : mode === 'css' ? `background-image: url("${dataUrl}");` : dataUrl;
  const handleFile = async (file?: File) => {
    if (!file) return;
    setBusy(true); setError(''); setDataUrl(''); setFileName(file.name);
    try { setDataUrl(await readImageDataUrl(file)); }
    catch (err) { setError(err instanceof Error ? err.message : '无法读取图片'); }
    finally { setBusy(false); }
  };
  const stash = async () => {
    if (!output) return;
    try {
    await useScratchpadStore.getState().addItemAsync({ name: `${fileName || 'image'}_base64.txt`, content: output, type: 'text', mimeType: 'text/plain', sourceTool: '图片转 Base64', originAction: 'image-to-base64' });
    notifyToast({ title: 'Base64 图片文本已送入暂存箱', tone: 'success' });
    setStashed(true); setTimeout(() => setStashed(false), 2000);
    } catch (err) { notifyToast({ title: '暂存箱保存失败', description: (err as Error).message, tone: 'error' }); }
  };
  return (
    <Card className="h-full flex flex-col"><CardHeader title={tr("图片转 Base64")} description={tr("选择图片，再选择 Data URL、纯 Base64 或直接可用的嵌入代码。")} />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto"><FileDropzone accept="image/*" fileName={fileName} disabled={busy} onFiles={files => handleFile(files[0])} title={tr("选择图片或拖到这里")} />{error && <WorkflowNotice tone="error">{error}</WorkflowNotice>}
        <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]"><div className="workflow-preview flex items-center justify-center p-4">{dataUrl ? <img src={dataUrl} alt={tr("预览")} className="max-h-80 max-w-full object-contain" /> : <WorkflowEmpty title={tr("图片预览")} description={tr("选择图片后生成嵌入代码。")} />}</div><section className="flex min-h-0 flex-col gap-3"><div className="workflow-segmented">{(['url', 'base64', 'html', 'css'] as const).map(value => (<button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'url' ? 'Data URL' : value === 'base64' ? 'Base64' : value.toUpperCase()}</button>))}</div><div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{output.length.toLocaleString()}{tr("字符")}</span><div className="flex gap-2"><Button size="sm" variant="secondary" onClick={stash} disabled={!output} icon={stashed ? <Check className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}>{tr("暂存")}</Button><Button size="sm" onClick={() => copy(output)} disabled={!output} icon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>{tr("复制代码")}</Button></div></div><Textarea readOnly aria-label={tr("图片编码结果")} className="min-h-64 flex-1 resize-y bg-slate-50 font-mono text-xs" value={output} placeholder={tr("选择图片后生成编码结果")} /></section></div>
      </CardContent>
    </Card>
  );
};

export const ImageWatermarkTool: React.FC = () => {
  useLocaleRender();
  const [imageUrl, setImageUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [text, setText] = useState('程序员百宝箱');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left' | 'center'>('bottom-right');
  const [opacity, setOpacity] = useState(.72);
  const [relativeSize, setRelativeSize] = useState(4);
  const [stashed, setStashed] = useState(false);
  const [error, setError] = useState('');
  const [renderedKey, setRenderedKey] = useState('');
  const [reading, setReading] = useState(false);
  const renderKey = JSON.stringify([imageUrl, text, position, opacity, relativeSize]);
  const ready = !!imageUrl && !reading && renderedKey === renderKey;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    loadImage(imageUrl).then(image => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current; canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d'); if (!context) return;
      context.drawImage(image, 0, 0);
      const fontSize = Math.max(8, Math.round(canvas.width * relativeSize / 100));
      context.font = `600 ${fontSize}px sans-serif`;
      context.fillStyle = `rgba(255,255,255,${opacity})`;
      context.strokeStyle = `rgba(15,23,42,${opacity * .62})`;
      context.lineWidth = Math.max(1, Math.round(fontSize / 12));
      context.textAlign = position === 'center' ? 'center' : position === 'bottom-left' ? 'left' : 'right';
      context.textBaseline = position === 'center' ? 'middle' : 'bottom';
      const x = position === 'center' ? canvas.width / 2 : position === 'bottom-left' ? fontSize : canvas.width - fontSize;
      const y = position === 'center' ? canvas.height / 2 : canvas.height - fontSize;
      context.strokeText(text, x, y); context.fillText(text, x, y); setRenderedKey(renderKey);
    }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : '无法读取图片'); });
    return () => { cancelled = true; };
  }, [imageUrl, text, position, opacity, relativeSize, renderKey]);
  const handleFile = async (file?: File) => {
    if (!file) return;
    setError(''); setSourceName(file.name); setReading(true); setImageUrl('');
    try { setImageUrl(await readImageDataUrl(file)); }
    catch (err) { setError(err instanceof Error ? err.message : '无法读取图片'); }
    finally { setReading(false); }
  };
  const stash = () => {
    if (!ready) return;
    canvasRef.current?.toBlob(async blob => {
      if (!blob) return;
      try {
      await useScratchpadStore.getState().addItemAsync({ name: `${sourceName || 'image'}_watermarked.png`, content: blob, type: 'image', mimeType: 'image/png', sourceTool: '图片水印', originAction: 'watermark-image' });
      notifyToast({ title: '水印图片已送入暂存箱', tone: 'success' }); setStashed(true); setTimeout(() => setStashed(false), 2000);
      } catch (err) { notifyToast({ title: '暂存箱保存失败', description: (err as Error).message, tone: 'error' }); }
    }, 'image/png');
  };
  const download = () => canvasRef.current?.toBlob(blob => { if (blob) downloadBlob(blob, `${sourceName || 'image'}_watermarked.png`); }, 'image/png');
  return (
    <Card className="h-full flex flex-col"><CardHeader title={tr("图片水印")} description={tr("先选择图片，文字、位置和透明度会实时反映在预览中。")} actions={<><Button size="sm" variant="secondary" onClick={stash} disabled={!ready} icon={stashed ? <Check className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}>{tr("暂存")}</Button><Button size="sm" onClick={download} disabled={!ready} icon={<Download className="h-4 w-4" />}>{tr("下载 PNG")}</Button></>} />
      <CardContent className="grid min-h-0 flex-1 gap-5 overflow-auto lg:grid-cols-[17rem_minmax(0,1fr)]"><section className="space-y-5"><FileDropzone accept="image/*" fileName={sourceName} disabled={reading} onFiles={files => handleFile(files[0])} compact title={tr("选择图片或拖到这里")} /><div><FieldLabel>{tr("水印文字")}</FieldLabel><Input aria-label={tr("水印文字")} value={text} onChange={event => setText(event.target.value)} /></div><div><FieldLabel>{tr("水印位置")}</FieldLabel><div className="workflow-segmented">{(['bottom-left', 'center', 'bottom-right'] as const).map(value => (<button key={value} aria-pressed={position === value} onClick={() => setPosition(value)}>{value === 'center' ? tr('居中') : value === 'bottom-left' ? tr('左下') : tr('右下')}</button>))}</div></div><label className="block text-xs text-slate-600">{tr("透明度 ·")}{Math.round(opacity * 100)}%<input aria-label={tr("水印透明度")} className="mt-3 w-full" type="range" min="0" max="1" step=".01" value={opacity} onChange={event => setOpacity(Number(event.target.value))} /></label><label className="block text-xs text-slate-600">{tr("文字大小 ·")}{relativeSize}%<input aria-label={tr("水印文字大小")} className="mt-3 w-full" type="range" min="1" max="12" step=".5" value={relativeSize} onChange={event => setRelativeSize(Number(event.target.value))} /></label>{error && <WorkflowNotice tone="error">{error}</WorkflowNotice>}</section><div className="workflow-preview flex flex-col items-center justify-center p-4"><canvas ref={canvasRef} className={imageUrl ? 'max-h-[65vh] max-w-full object-contain' : 'hidden'} />{!imageUrl && <WorkflowEmpty title={tr("水印实时预览")} description={tr("选择图片后调整左侧选项，再下载处理结果。")} icon={<Palette className="h-6 w-6" />} />}</div></CardContent>
    </Card>
  );
};

export const PerlerBeadTool: React.FC = () => {
  useLocaleRender();
  const [imageUrl, setImageUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [pixelSize, setPixelSize] = useState(45);
  const [maxColors, setMaxColors] = useState(8);
  const [result, setResult] = useState<BeadPatternResult | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!imageUrl) {
      Promise.resolve().then(() => {
        setResult(null);
        setError('');
      });
      return;
    }

    let isCancelled = false;
    setIsProcessing(true);
    setError('');

    let currentWorker: Worker;
    try {
      currentWorker = new Worker(new URL('./perler.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = currentWorker;
    } catch (error) {
      setIsProcessing(false);
      setResult(null);
      setError(error instanceof Error ? error.message : 'Worker 启动失败');
      return;
    }
    setResult(null);

    getSquareSamplePixels(imageUrl, pixelSize)
      .then(pixels => {
        if (isCancelled) return;

        currentWorker!.onmessage = (event: MessageEvent<{ type: string; result?: BeadPatternResult; error?: string }>) => {
          if (isCancelled) return;
          setIsProcessing(false);

          if (event.data.type === 'success') {
            setResult(event.data.result!);
          } else {
            setResult(null);
            setError(event.data.error || '拼豆图纸生成失败。');
          }
        };

        currentWorker!.onerror = event => {
          if (isCancelled) return;
          setIsProcessing(false);
          setResult(null);
          setError(event.message || 'Worker 执行错误');
        };

        currentWorker!.postMessage({ pixels, size: pixelSize, maxColors });
      })
      .catch((reason: unknown) => {
        if (isCancelled) return;
        setIsProcessing(false);
        setResult(null);
        setError(reason instanceof Error ? reason.message : '提取图像像素失败。');
      });

    return () => {
      isCancelled = true;
      currentWorker.terminate();
      if (workerRef.current === currentWorker) workerRef.current = null;
    };
  }, [imageUrl, maxColors, pixelSize]);

  useEffect(() => {
    if (!result || !canvasRef.current) return;

    try {
      drawBeadChart(canvasRef.current, result);
    } catch (reason) {
      Promise.resolve().then(() => {
        setError(reason instanceof Error ? reason.message : '图纸预览绘制失败。');
      });
    }
  }, [result]);

  const handleFile = async (file?: File) => {
    if (!file) return;

    try {
      setSourceName(file.name);
      setImageUrl(await readImageDataUrl(file));
    } catch (reason) {
      setResult(null);
      setImageUrl('');
      setError(reason instanceof Error ? reason.message : '图片读取失败。');
    }
  };

  const updatePixelSize = (value: number) => {
    setPixelSize(clampNumber(Math.round(value || 16), 16, 96));
  };

  const updateMaxColors = (value: number) => {
    setMaxColors(clampNumber(Math.round(value || 2), 2, 24));
  };

  const download = () => {
    if (!result || !canvasRef.current) return;

    try {
      drawBeadChart(canvasRef.current, result);
      canvasRef.current.toBlob(blob => {
        if (blob) downloadBlob(blob, `perler-beads-${result.size}x${result.size}.png`);
      }, 'image/png');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '图纸导出失败。');
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title={tr("拼豆图纸生成")}
        description={tr("上传图片，本地生成方形拼豆网格、色板图例与可下载图纸。")}
        actions={
          <Button
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={download}
            disabled={!result || isProcessing}
          >{tr("下载图纸")}</Button>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-auto xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <FileDropzone accept="image/*" fileName={sourceName} disabled={isProcessing} onFiles={files => handleFile(files[0])} title={tr("选择拼豆参考图")} hint={tr("JPG / PNG / WebP，本地处理不上传")} />
          <div className="workflow-segmented">
            <button type="button" onClick={() => { updatePixelSize(32); updateMaxColors(8); }}>{tr("入门 · 32 格")}</button>
            <button type="button" onClick={() => { updatePixelSize(64); updateMaxColors(16); }}>{tr("精细 · 64 格")}</button>
          </div>

          <div className="tool-section space-y-4 p-4">
            <div>
              <FieldLabel hint={`${pixelSize} x ${pixelSize}`}>{tr("像素数")}</FieldLabel>
              <div className="grid grid-cols-[1fr_5.5rem] items-center gap-3">
                <input
                  type="range"
                  min="16"
                  max="96"
                  step="1"
                  value={pixelSize}
                  onChange={event => updatePixelSize(Number(event.target.value))}
                  className="w-full"
                />
                <Input
                  type="number"
                  min="16"
                  max="96"
                  value={pixelSize}
                  onChange={event => updatePixelSize(Number(event.target.value))}
                />
              </div>
            </div>

            <div>
              <FieldLabel hint={`最多 ${maxColors} 色`}>{tr("最大颜色数")}</FieldLabel>
              <div className="grid grid-cols-[1fr_5.5rem] items-center gap-3">
                <input
                  type="range"
                  min="2"
                  max="24"
                  step="1"
                  value={maxColors}
                  onChange={event => updateMaxColors(Number(event.target.value))}
                  className="w-full"
                />
                <Input
                  type="number"
                  min="2"
                  max="24"
                  value={maxColors}
                  onChange={event => updateMaxColors(Number(event.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="tool-panel overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="truncate text-sm font-semibold text-slate-800">{sourceName || tr('源图预览')}</div>
              <div className="mt-1 text-xs text-slate-500">{tr("按中心方形裁切生成图案")}</div>
            </div>
            <div className="flex min-h-48 items-center justify-center bg-white p-3">
              {imageUrl ? (
                <img src={imageUrl} alt={tr("拼豆源图")} className="max-h-64 w-full rounded-lg object-contain" />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-slate-400">{tr("等待上传图片")}</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          {error && <div className="status-error px-4 py-3 text-sm">{error}</div>}

          <div className="tool-section flex flex-none flex-col overflow-hidden">
            <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">{tr("图纸预览")}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {result ? `${result.size * result.size} 颗 · ${result.palette.length} 色` : tr('生成后可下载完整 PNG')}
                </div>
              </div>
              {isProcessing && <div className="text-xs font-medium text-primary-700">{tr("正在生成...")}</div>}
            </div>
            <div className="flex min-h-[24rem] items-center justify-center overflow-hidden bg-slate-50 p-4" style={{ height: 'min(68vh, 48rem)' }}>
              <canvas
                ref={canvasRef}
                className={result ? 'h-full w-full rounded-lg border border-slate-200 bg-white object-contain shadow-sm' : 'hidden'}
              />
              {!result && (
                <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm text-slate-400">{tr("上传图片后生成拼豆图纸")}</div>
              )}
            </div>
          </div>

          {result && (
            <div className="tool-panel flex-none overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
                <div className="text-xs font-semibold text-slate-700">{tr("颜色清单")}</div>
                <div className="text-xs text-slate-500">{result.palette.length}{tr("色")}</div>
              </div>
              <div className="app-scrollbar grid max-h-64 gap-2 overflow-auto p-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {result.palette.map((entry, index) => ((
                  <div key={`${entry.hex}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <div className="h-6 w-6 flex-none rounded-md border border-slate-200" style={{ backgroundColor: entry.hex }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-800">
                        #{String(index + 1).padStart(2, '0')} <span className="font-mono font-medium text-slate-500">{entry.hex.toUpperCase()}</span>
                      </div>
                      <div className="text-[11px] leading-4 text-slate-500">{entry.count}{tr("颗")}</div>
                    </div>
                  </div>
                )))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
