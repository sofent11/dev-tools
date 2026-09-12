import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Download, Pipette, RotateCcw, ScanLine } from 'lucide-react';
import { useI18n } from '../../../src/i18n';
import { downloadBlob } from '../shared/fileUtils';
import {
  calculateVisualCentroid,
  parseHexColor,
  removeBackgroundByColor,
  rgbToHex,
  sampleImageDataColor,
  type CentroidResult,
} from './visualCentroidCore';

const copyText = {
  'zh-CN': {
    title: '视觉质心计算器',
    upload: '选择图片',
    alpha: 'Alpha 阈值',
    tolerance: '背景容差',
    bgColor: '背景色',
    pick: '点击画布取色',
    remove: '移除背景',
    reset: '恢复原图',
    export: '导出标记图',
    centroid: '视觉质心',
    bbox: '包围盒中心',
    visible: '有效像素',
    noImage: '选择带透明区域或纯色背景的图片后开始计算。',
    picking: '取样模式已开启，请点击图片。',
  },
  'en-US': {
    title: 'Visual Centroid Calculator',
    upload: 'Choose image',
    alpha: 'Alpha threshold',
    tolerance: 'Background tolerance',
    bgColor: 'Background color',
    pick: 'Pick on canvas',
    remove: 'Remove background',
    reset: 'Reset image',
    export: 'Export marked image',
    centroid: 'Visual centroid',
    bbox: 'Bounding box center',
    visible: 'visible pixels',
    noImage: 'Choose an image with transparency or a solid background to begin.',
    picking: 'Pick mode is active. Click the image.',
  },
} as const;

const drawMarker = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, label: string) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 14, y);
  ctx.lineTo(x + 14, y);
  ctx.moveTo(x, y - 14);
  ctx.lineTo(x, y + 14);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(label, x + 8, y - 8);
  ctx.restore();
};

export const VisualCentroidTool: React.FC = () => {
  const { locale } = useI18n();
  const c = copyText[locale];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [original, setOriginal] = useState<ImageData | null>(null);
  const [working, setWorking] = useState<ImageData | null>(null);
  const [fileName, setFileName] = useState('');
  const [alphaThreshold, setAlphaThreshold] = useState(127);
  const [tolerance, setTolerance] = useState(50);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [picking, setPicking] = useState(false);
  const result: CentroidResult | null = useMemo(
    () => working ? calculateVisualCentroid(working, alphaThreshold) : null,
    [alphaThreshold, working],
  );

  const redraw = useCallback((source: ImageData | null, computed: CentroidResult | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.putImageData(source, 0, 0);
    if (computed?.boundingBox) {
      const box = computed.boundingBox;
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(box.minX, box.minY, box.width, box.height);
      ctx.restore();
      drawMarker(ctx, box.center.x, box.center.y, '#f59e0b', 'BBOX');
    }
    if (computed?.centroid) {
      drawMarker(ctx, computed.centroid.x, computed.centroid.y, '#ef4444', 'C');
    }
  }, []);

  useEffect(() => {
    redraw(working, result);
  }, [redraw, result, working]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const bitmap = await createImageBitmap(file);
    const offscreen = document.createElement('canvas');
    offscreen.width = bitmap.width;
    offscreen.height = bitmap.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    setOriginal(imageData);
    setWorking(imageData);
  };

  const handleRemoveBackground = () => {
    if (!working) return;
    setWorking(removeBackgroundByColor(working, parseHexColor(bgColor), tolerance));
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!picking || !working || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * working.width;
    const y = ((event.clientY - rect.top) / rect.height) * working.height;
    setBgColor(rgbToHex(sampleImageDataColor(working, x, y)));
    setPicking(false);
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas || !working) return;
    canvas.toBlob(blob => {
      if (blob) downloadBlob(blob, `${fileName || 'visual-centroid'}-marked.png`);
    }, 'image/png');
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="tool-panel min-h-[30rem] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{c.title}</h3>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white">
            <ScanLine className="h-4 w-4" />
            {c.upload}
            <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
          </label>
        </div>
        {picking && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{c.picking}</div>}
        {working ? (
          <div className="overflow-auto rounded-lg border border-slate-200 bg-[conic-gradient(#e2e8f0_25%,transparent_0_50%,#e2e8f0_0_75%,transparent_0)_0_0/24px_24px] p-3 dark:border-slate-800 dark:bg-[conic-gradient(#1e293b_25%,transparent_0_50%,#1e293b_0_75%,transparent_0)_0_0/24px_24px]">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="max-h-[70vh] max-w-full rounded-md shadow-sm"
            />
          </div>
        ) : (
          <div className="flex min-h-80 items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700">
            {c.noImage}
          </div>
        )}
      </section>

      <aside className="tool-panel space-y-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {c.alpha}: <span className="font-mono">{alphaThreshold}</span>
          <input
            type="range"
            min={1}
            max={255}
            value={alphaThreshold}
            onChange={event => setAlphaThreshold(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {c.bgColor}
          <input
            type="color"
            value={bgColor}
            onChange={event => setBgColor(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 dark:border-slate-800"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {c.tolerance}: <span className="font-mono">{tolerance}</span>
          <input
            type="range"
            min={0}
            max={255}
            value={tolerance}
            onChange={event => setTolerance(Number(event.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <div className="grid gap-2">
          <button type="button" onClick={() => setPicking(true)} disabled={!working} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium disabled:opacity-50 dark:border-slate-800">
            <Pipette className="h-4 w-4" />
            {c.pick}
          </button>
          <button type="button" onClick={handleRemoveBackground} disabled={!working} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">
            <Crosshair className="h-4 w-4" />
            {c.remove}
          </button>
          <button type="button" onClick={() => original && setWorking(original)} disabled={!original} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-medium disabled:opacity-50 dark:border-slate-800">
            <RotateCcw className="h-4 w-4" />
            {c.reset}
          </button>
          <button type="button" onClick={handleExport} disabled={!working} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary-600 text-sm font-semibold text-white disabled:opacity-50">
            <Download className="h-4 w-4" />
            {c.export}
          </button>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900">
          <div className="flex justify-between gap-3 py-1">
            <span>{c.centroid}</span>
            <span className="font-mono">{result?.centroid ? `${result.centroid.x.toFixed(1)}, ${result.centroid.y.toFixed(1)}` : '-'}</span>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <span>{c.bbox}</span>
            <span className="font-mono">{result?.boundingBox ? `${result.boundingBox.center.x.toFixed(1)}, ${result.boundingBox.center.y.toFixed(1)}` : '-'}</span>
          </div>
          <div className="flex justify-between gap-3 py-1">
            <span>{c.visible}</span>
            <span className="font-mono">{(result?.visiblePixels || 0).toLocaleString()}</span>
          </div>
        </div>
      </aside>
    </div>
  );
};
