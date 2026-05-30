import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Download, ImagePlus, Palette, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { FieldLabel, Input, Textarea, UploadPanel } from '../../ui/ToolUi';
import { downloadBlob, readFileAsDataUrl } from '../shared/fileUtils';
import { useCopyToClipboard } from '../shared/useCopyToClipboard';

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
    image.onload = () => resolve(image);
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
  const [imageUrl, setImageUrl] = useState('');
  const [colors, setColors] = useState<Swatch[]>([]);
  const { copied, copy } = useCopyToClipboard();

  const handleFile = async (file?: File) => {
    if (!file) return;
    const url = await readFileAsDataUrl(file);
    setImageUrl(url);
    setColors(await getPalette(url));
  };

  const colorText = useMemo(() => colors.map(color => color.hex).join('\n'), [colors]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="图片颜色提取" description="Canvas 本地采样主色与调色板。" />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-auto lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <UploadPanel>
            <label className="flex cursor-pointer flex-col items-center gap-2 p-6 text-center">
              <Upload className="h-8 w-8 text-primary-600" />
              <span className="text-sm font-medium text-slate-700">选择图片</span>
              <input className="hidden" type="file" accept="image/*" onChange={event => handleFile(event.target.files?.[0])} />
            </label>
          </UploadPanel>
          {imageUrl && <img src={imageUrl} alt="待提取图片" className="max-h-80 rounded-lg border border-slate-200 object-contain" />}
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {colors.map(color => (
              <button key={color.hex} type="button" className="tool-panel overflow-hidden text-left" onClick={() => copy(color.hex)}>
                <div className="h-20" style={{ backgroundColor: color.hex }} />
                <div className="p-3 font-mono text-sm text-slate-800">{color.hex}</div>
              </button>
            ))}
          </div>
          <Button variant="secondary" icon={copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} onClick={() => copy(colorText)} disabled={!colors.length}>
            复制色板
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const ImageToBase64Tool: React.FC = () => {
  const [dataUrl, setDataUrl] = useState('');
  const { copied, copy } = useCopyToClipboard();

  const handleFile = async (file?: File) => {
    if (!file) return;
    setDataUrl(await readFileAsDataUrl(file));
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="图片转 Base64" description="把图片转换为可嵌入 HTML/CSS 的 Data URL。" />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <UploadPanel>
          <label className="flex cursor-pointer flex-col items-center gap-2 p-6 text-center">
            <ImagePlus className="h-8 w-8 text-primary-600" />
            <span className="text-sm font-medium text-slate-700">选择图片</span>
            <input className="hidden" type="file" accept="image/*" onChange={event => handleFile(event.target.files?.[0])} />
          </label>
        </UploadPanel>
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[18rem_1fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            {dataUrl ? <img src={dataUrl} alt="预览" className="h-full max-h-80 w-full object-contain" /> : <div className="flex h-48 items-center justify-center text-sm text-slate-400">预览</div>}
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center justify-between">
              <FieldLabel>Data URL</FieldLabel>
              <Button size="sm" variant="secondary" onClick={() => copy(dataUrl)} disabled={!dataUrl}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Textarea readOnly className="min-h-0 flex-1 resize-none bg-slate-50 font-mono text-xs" value={dataUrl} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const ImageWatermarkTool: React.FC = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [text, setText] = useState('程序员百宝箱');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = async (src = imageUrl, mark = text) => {
    if (!src || !canvasRef.current) return;
    const image = await loadImage(src);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(image, 0, 0);
    const fontSize = Math.max(20, Math.round(canvas.width / 24));
    context.font = `600 ${fontSize}px sans-serif`;
    context.fillStyle = 'rgba(255,255,255,0.72)';
    context.strokeStyle = 'rgba(15,23,42,0.45)';
    context.lineWidth = Math.max(2, Math.round(fontSize / 12));
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.strokeText(mark, canvas.width - fontSize, canvas.height - fontSize);
    context.fillText(mark, canvas.width - fontSize, canvas.height - fontSize);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    const url = await readFileAsDataUrl(file);
    setImageUrl(url);
    window.setTimeout(() => draw(url, text), 0);
  };

  const download = () => {
    canvasRef.current?.toBlob(blob => {
      if (blob) downloadBlob(blob, 'watermarked.png');
    }, 'image/png');
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader title="图片水印" description="使用 Canvas 在本地添加文字水印。" actions={<Button size="sm" icon={<Download className="h-4 w-4" />} onClick={download} disabled={!imageUrl}>下载</Button>} />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-auto lg:grid-cols-[18rem_1fr]">
        <div className="space-y-4">
          <UploadPanel>
            <label className="flex cursor-pointer flex-col items-center gap-2 p-6 text-center">
              <Upload className="h-8 w-8 text-primary-600" />
              <span className="text-sm font-medium text-slate-700">选择图片</span>
              <input className="hidden" type="file" accept="image/*" onChange={event => handleFile(event.target.files?.[0])} />
            </label>
          </UploadPanel>
          <div>
            <FieldLabel>水印文字</FieldLabel>
            <Input value={text} onChange={event => { setText(event.target.value); draw(imageUrl, event.target.value); }} />
          </div>
        </div>
        <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3">
          <canvas ref={canvasRef} className="max-h-[70vh] max-w-full" />
          {!imageUrl && <div className="flex h-64 items-center justify-center gap-2 text-slate-400"><Palette className="h-5 w-5" />等待图片</div>}
        </div>
      </CardContent>
    </Card>
  );
};

export const PerlerBeadTool: React.FC = () => {
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

    let currentWorker = workerRef.current;
    if (!currentWorker) {
      currentWorker = new Worker(new URL('./perler.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = currentWorker;
    }

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
      setImageUrl(await readFileAsDataUrl(file));
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
        title="拼豆图纸生成"
        description="上传图片，本地生成方形拼豆网格、色板图例与可下载图纸。"
        actions={
          <Button
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={download}
            disabled={!result || isProcessing}
          >
            下载图纸
          </Button>
        }
      />
      <CardContent className="grid min-h-0 flex-1 gap-4 overflow-auto xl:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <UploadPanel className="min-h-[9rem]">
            <label className="flex cursor-pointer flex-col items-center gap-2 p-6 text-center">
              <ImagePlus className="h-8 w-8 text-primary-600" />
              <span className="text-sm font-medium text-slate-700">选择拼豆参考图</span>
              <span className="text-xs text-slate-400">JPG / PNG / WebP，本地处理不上传</span>
              <input className="hidden" type="file" accept="image/*" onChange={event => handleFile(event.target.files?.[0])} />
            </label>
          </UploadPanel>

          <div className="tool-section space-y-4 p-4">
            <div>
              <FieldLabel hint={`${pixelSize} x ${pixelSize}`}>像素数</FieldLabel>
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
              <FieldLabel hint={`最多 ${maxColors} 色`}>最大颜色数</FieldLabel>
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
              <div className="truncate text-sm font-semibold text-slate-800">{sourceName || '源图预览'}</div>
              <div className="mt-1 text-xs text-slate-500">按中心方形裁切生成图案</div>
            </div>
            <div className="flex min-h-48 items-center justify-center bg-white p-3">
              {imageUrl ? (
                <img src={imageUrl} alt="拼豆源图" className="max-h-64 w-full rounded-lg object-contain" />
              ) : (
                <div className="flex h-48 items-center justify-center text-sm text-slate-400">等待上传图片</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          {error && <div className="status-error px-4 py-3 text-sm">{error}</div>}

          <div className="tool-section flex flex-none flex-col overflow-hidden">
            <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-800">图纸预览</div>
                <div className="mt-1 text-xs text-slate-500">
                  {result ? `${result.size * result.size} 颗 · ${result.palette.length} 色` : '生成后可下载完整 PNG'}
                </div>
              </div>
              {isProcessing && <div className="text-xs font-medium text-primary-700">正在生成...</div>}
            </div>
            <div className="flex min-h-[24rem] items-center justify-center overflow-hidden bg-slate-50 p-4" style={{ height: 'min(68vh, 48rem)' }}>
              <canvas
                ref={canvasRef}
                className={result ? 'h-full w-full rounded-lg border border-slate-200 bg-white object-contain shadow-sm' : 'hidden'}
              />
              {!result && (
                <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white text-sm text-slate-400">
                  上传图片后生成拼豆图纸
                </div>
              )}
            </div>
          </div>

          {result && (
            <div className="tool-panel flex-none overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2">
                <div className="text-xs font-semibold text-slate-700">颜色清单</div>
                <div className="text-xs text-slate-500">{result.palette.length} 色</div>
              </div>
              <div className="app-scrollbar grid max-h-24 gap-2 overflow-auto p-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {result.palette.map((entry, index) => (
                  <div key={`${entry.hex}-${index}`} className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                    <div className="h-6 w-6 flex-none rounded-md border border-slate-200" style={{ backgroundColor: entry.hex }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold text-slate-800">
                        #{String(index + 1).padStart(2, '0')} <span className="font-mono font-medium text-slate-500">{entry.hex.toUpperCase()}</span>
                      </div>
                      <div className="text-[11px] leading-4 text-slate-500">{entry.count} 颗</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
