import React, { useMemo, useRef, useState } from 'react';
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
