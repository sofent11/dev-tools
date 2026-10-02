import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, Download, Pipette, RotateCcw } from 'lucide-react';
import { useI18n } from '../../../src/i18n';
import { Button } from '../../ui/Button';
import { downloadBlob } from '../shared/fileUtils';
import { FileDropzone, WorkflowEmpty, WorkflowNotice, WorkflowSteps } from '../shared/WorkflowUi';
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
    prepare: '背景预处理',
    legend: '红色 C 为视觉质心，橙色 BBOX 为包围盒中心。坐标以左上角为原点。',
    noPixels: '当前阈值下没有有效像素，请降低 Alpha 阈值或恢复原图。',
    readError: '图片读取失败，请更换文件。',
    fileLimit: '图片上限为 16 MB 和 1600 万像素，请先缩小图片。',
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
    prepare: 'Prepare background',
    legend: 'Red C marks the visual centroid; orange BBOX marks the bounding box center. Coordinates start at the top-left.',
    noPixels: 'No visible pixels at this threshold. Lower the alpha threshold or reset the image.',
    readError: 'Could not read this image. Choose another file.',
    fileLimit: 'Image limit: 16 MB and 16 million pixels. Resize the image first.',
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
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
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

  const handleFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setReading(true); setError(''); setPicking(false);
    try {
      if (file.size > 16 * 1024 * 1024) throw new Error(c.fileLimit);
      const bitmap = await createImageBitmap(file);
      try {
        if (bitmap.width * bitmap.height > 16_000_000) throw new Error(c.fileLimit);
        const offscreen = document.createElement('canvas');
        offscreen.width = bitmap.width; offscreen.height = bitmap.height;
        const ctx = offscreen.getContext('2d');
        if (!ctx) throw new Error(c.readError);
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
        setOriginal(imageData); setWorking(imageData); setFileName(file.name);
      } finally { bitmap.close(); }
    } catch (error) { setError(error instanceof Error && error.message === c.fileLimit ? c.fileLimit : c.readError); }
    finally { setReading(false); }
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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="xl:col-span-2 space-y-3">
        <WorkflowSteps steps={['导入图片', '检查中心与背景', '导出标记图']} active={working ? 1 : 0} />
        <FileDropzone accept="image/*" onFiles={handleFile} disabled={reading} fileName={fileName} title={c.upload} />
        {error && <WorkflowNotice tone="error">{error}</WorkflowNotice>}
      </div>
      <section className="tool-panel min-h-80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">{c.title}</h3>
          <button type="button" onClick={handleExport} disabled={!working || reading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary-600 px-3 text-sm font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" />{c.export}</button>
        </div>
        {picking && <WorkflowNotice onDismiss={() => setPicking(false)}>{c.picking}</WorkflowNotice>}
        {working ? <>
          <div className="workflow-preview overflow-auto p-3">
            <canvas ref={canvasRef} onClick={handleCanvasClick} className={`max-h-[65vh] max-w-full rounded-md ${picking ? 'cursor-crosshair' : ''}`} />
          </div>
          <p className="text-xs leading-5 text-slate-500">{c.legend}</p>
        </> : <WorkflowEmpty title={c.upload} description={c.noImage} icon={<Crosshair className="h-6 w-6" />} />}
      </section>
      <aside className="tool-panel space-y-5">
        <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between gap-3"><span>{c.centroid}</span><strong data-i18n-skip className="font-mono text-red-600">{result?.centroid ? `${result.centroid.x.toFixed(1)}, ${result.centroid.y.toFixed(1)}` : '—'}</strong></div>
          <div className="flex justify-between gap-3"><span>{c.bbox}</span><strong data-i18n-skip className="font-mono text-amber-600">{result?.boundingBox ? `${result.boundingBox.center.x.toFixed(1)}, ${result.boundingBox.center.y.toFixed(1)}` : '—'}</strong></div>
          <div className="flex justify-between gap-3"><span>{c.visible}</span><strong data-i18n-skip className="font-mono">{(result?.visiblePixels || 0).toLocaleString()}</strong></div>
        </div>
        {working && !result?.visiblePixels && <WorkflowNotice>{c.noPixels}</WorkflowNotice>}
        <fieldset disabled={!working || reading} className="space-y-5 disabled:opacity-50">
          <label className="block text-sm font-medium">{c.alpha}: <span className="font-mono">{alphaThreshold}</span><input type="range" min={1} max={255} value={alphaThreshold} onChange={event => setAlphaThreshold(Number(event.target.value))} className="mt-2 w-full" /></label>
          <details className="workflow-settings"><summary>{c.prepare}</summary><div className="space-y-4 pt-4">
            <label className="block text-sm font-medium">{c.bgColor}<input type="color" value={bgColor} onChange={event => setBgColor(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-slate-200" /></label>
            <label className="block text-sm font-medium">{c.tolerance}: <span className="font-mono">{tolerance}</span><input type="range" min={0} max={255} value={tolerance} onChange={event => setTolerance(Number(event.target.value))} className="mt-2 w-full" /></label>
            <Button variant="secondary" onClick={() => setPicking(!picking)} aria-pressed={picking} className="w-full"><Pipette className="h-4 w-4" />{c.pick}</Button>
            <Button onClick={handleRemoveBackground} className="w-full"><Crosshair className="h-4 w-4" />{c.remove}</Button>
          </div></details>
          <Button variant="secondary" onClick={() => { if (original) setWorking(original); setPicking(false); }} className="w-full"><RotateCcw className="h-4 w-4" />{c.reset}</Button>
        </fieldset>
      </aside>
    </div>
  );
};
