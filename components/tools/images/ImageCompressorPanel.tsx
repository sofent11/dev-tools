import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import React, { useEffect, useRef, useState } from 'react';
import { Check, ClipboardList, Download, RefreshCw } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { notifyToast } from '../shared/notifyToast';
import { useScratchpadStore } from '../shared/scratchpadStore';
import { downloadBlob, formatBytes, getBaseName } from './imageToolUtils';
import { FileDropzone, WorkflowEmpty, WorkflowNotice, WorkflowSteps } from '../shared/WorkflowUi';
import { loadRuntimeAsset } from '../shared/runtimeAssetLoader';
import { runtimeAsset } from '../shared/runtimeAssets';

export const ImageCompressorPanel: React.FC = () => {
  useLocaleRender();
  const [file, setFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<Blob | null>(null);
  const [compressedPreviewUrl, setCompressedPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [originalUrl, setOriginalUrl] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const activeJob = useRef<AbortController | null>(null);
  const selectionVersion = useRef(0);
  const resultRef = useRef<Blob | null>(null);
  const [options, setOptions] = useState({
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'original',
  });

  useEffect(() => () => {
    selectionVersion.current += 1;
    activeJob.current?.abort();
    activeJob.current = null;
  }, []);

  useEffect(() => {
    if (!compressedFile) {
      setCompressedPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(compressedFile);
    setCompressedPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [compressedFile]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file); setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectFile = async (files: File[]) => {
    const selected = files[0];
    if (!selected) return;
    const version = ++selectionVersion.current;
    activeJob.current?.abort();
    resultRef.current = null;
    setFile(null); setCompressedFile(null); setStashed(false); setError('');
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片；动画格式不支持保留帧。');
      if (selected.size > 64 * 1024 * 1024) throw new Error('图片不能超过 64 MB。');
      const bitmap = await createImageBitmap(selected);
      try {
        if (bitmap.width * bitmap.height > 24_000_000) throw new Error('图片超过 2,400 万像素，请缩小后重试。');
      } finally { bitmap.close(); }
      if (version === selectionVersion.current) setFile(selected);
    } catch (err) {
      if (version === selectionVersion.current) setError(err instanceof Error ? err.message : '无法读取图片，请重新选择。');
    }
  };
  const updateOptions = (values: Partial<typeof options>) => {
    setOptions(previous => ({ ...previous, ...values })); resultRef.current = null; setCompressedFile(null); setStashed(false); setError('');
  };

  const handleCompress = async () => {
    if (!file || activeJob.current) return;

    const controller = new AbortController();
    activeJob.current = controller;
    const deadline = setTimeout(() => controller.abort(), 30_000);
    let workerLibraryUrl = '';
    setIsCompressing(true); setError(''); setProgress(0); resultRef.current = null; setCompressedFile(null); setStashed(false);
    try {
      const asset = runtimeAsset('imageCompression');
      const response = await loadRuntimeAsset<Response>({ ...asset, kind: 'asset', label: 'Image compression worker', expectedSha256: asset.sha256, timeoutMs: 15_000, retries: 0, cache: true });
      if (controller.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      workerLibraryUrl = URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: 'application/javascript' }));
      const compressionOptions = {
        maxSizeMB: options.maxSizeMB,
        maxWidthOrHeight: options.maxWidthOrHeight,
        useWebWorker: options.useWebWorker,
        fileType: options.fileType === 'original' ? undefined : options.fileType,
        libURL: workerLibraryUrl,
        signal: controller.signal,
        onProgress: (value: number) => {
          if (activeJob.current === controller && !controller.signal.aborted) setProgress(Math.round(value));
        },
      };

      const compressedBlob = await imageCompression(file, compressionOptions);
      if (controller.signal.aborted || activeJob.current !== controller) return;
      resultRef.current = compressedBlob;
      setCompressedFile(compressedBlob);
    } catch (error) {
      if (activeJob.current !== controller) return;
      if (controller.signal.aborted) { setError('压缩已取消或超时；可以调整设置后重试。'); return; }
      setError((error as Error).message);
      notifyToast({ title: '图片压缩失败', description: (error as Error).message, tone: 'error' });
    } finally {
      clearTimeout(deadline);
      if (workerLibraryUrl) URL.revokeObjectURL(workerLibraryUrl);
      if (activeJob.current === controller) { activeJob.current = null; setIsCompressing(false); }
    }
  };

  const [stashed, setStashed] = useState(false);

  const stashToScratchpad = async () => {
    if (!compressedFile) return;
    let extension = file?.name.split('.').pop() || 'jpg';
    if (compressedFile.type) extension = compressedFile.type.split('/')[1] || extension;
    const name = file ? getBaseName(file.name) : 'image';

    try {
      await useScratchpadStore.getState().addItemAsync({
        name: `${name}_compressed.${extension}`,
        content: compressedFile,
        type: 'image',
        mimeType: compressedFile.type,
        sourceTool: '图片压缩器',
        originAction: 'compress-image',
      });
      if (resultRef.current === compressedFile) setStashed(true);
      notifyToast({ title: '压缩图片已送入暂存箱', tone: 'success' });
      setTimeout(() => setStashed(false), 2000);
    } catch (err) {
      notifyToast({
        title: '暂存压缩图片失败',
        description: err instanceof Error ? `${err.message}。可先下载到本地或清理暂存箱空间后重试。` : '浏览器本地存储不可用，请下载到本地或清理空间。',
        tone: 'error',
        actionLabel: '下载本地文件',
        onAction: downloadImage,
      });
    }
  };

  const downloadImage = () => {
    if (!compressedFile) return;

    let extension = file?.name.split('.').pop() || 'jpg';
    if (compressedFile.type) extension = compressedFile.type.split('/')[1] || extension;

    const name = file ? getBaseName(file.name) : 'image';
    downloadBlob(compressedFile, `${name}_compressed.${extension}`);
  };

  return (
    <CardContent className="flex-1 flex flex-col gap-4 overflow-auto">
      <WorkflowSteps steps={['选择图片', '设置压缩', '检查与导出']} active={!file ? 0 : compressedFile ? 2 : 1} />
      <FileDropzone accept="image/jpeg,image/png,image/webp" fileName={file?.name} onFiles={files => { void selectFile(files); }} disabled={isCompressing} title={tr("选择图片或拖到这里")} hint={tr("JPG / PNG / WebP · 浏览器本地压缩")} />
      {error && <WorkflowNotice tone="error">{tr(error)}</WorkflowNotice>}
      {isCompressing && <div className="flex items-center justify-between gap-3 text-sm" role="status"><span>{tr("压缩进度 ·")}{progress}%</span><Button variant="secondary" size="sm" onClick={() => activeJob.current?.abort()}>{tr("取消压缩")}</Button></div>}
      {file ? <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <fieldset disabled={isCompressing} className="space-y-5">
          <div><h3 className="mb-3 text-xs font-semibold text-slate-700">{tr("压缩用途")}</h3><div className="workflow-segmented">
            <button type="button" onClick={() => updateOptions({ maxSizeMB: .3, maxWidthOrHeight: 1280, fileType: 'image/webp' })}>{tr("网页")}</button>
            <button type="button" onClick={() => updateOptions({ maxSizeMB: 1, maxWidthOrHeight: 1920, fileType: 'original' })}>{tr("平衡")}</button>
            <button type="button" onClick={() => updateOptions({ maxSizeMB: 3, maxWidthOrHeight: 3840, fileType: 'original' })}>{tr("高清")}</button>
          </div></div>
          <label className="block text-xs text-slate-600">{tr("目标大小（MB）")}<input aria-label={tr("目标大小（MB）")} type="number" min=".1" max="64" step=".1" value={options.maxSizeMB} onChange={event => updateOptions({ maxSizeMB: Math.min(64, Math.max(.1, Number(event.target.value) || .1)) })} className="mt-2 h-10 w-full rounded border border-slate-200 px-3 text-sm" /></label>
          <label className="block text-xs text-slate-600">{tr("最大边长（px）")}<input aria-label={tr("最大边长（px）")} type="number" min="1" max="8192" step="100" value={options.maxWidthOrHeight} onChange={event => updateOptions({ maxWidthOrHeight: Math.min(8192, Math.max(1, Math.round(Number(event.target.value)) || 1920)) })} className="mt-2 h-10 w-full rounded border border-slate-200 px-3 text-sm" /></label>
          <label className="block text-xs text-slate-600">{tr("输出格式")}<select aria-label={tr("输出格式")} value={options.fileType} onChange={event => updateOptions({ fileType: event.target.value })} className="mt-2 h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm"><option value="original">{tr("保持原格式")}</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>
          <Button onClick={handleCompress} isLoading={isCompressing} className="w-full" icon={<RefreshCw className="h-4 w-4" />}>{isCompressing ? tr('正在压缩...') : tr('压缩图片')}</Button>
          <p className="text-xs leading-6 text-slate-500">{tr("目标大小是压缩参考。PNG 保留透明度，JPEG 会丢失透明度。")}</p>
        </fieldset>
        <section className="flex min-h-0 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">{compressedFile ? tr('压缩结果') : tr('原图与结果对比')}</h3><p className="mt-1 text-xs text-slate-500">{formatBytes(file.size)}{compressedFile && ` → ${formatBytes(compressedFile.size)} · ${compressedFile.size <= file.size ? tr('节省') : tr('增加')} ${Math.abs((file.size - compressedFile.size) / Math.max(file.size, 1) * 100).toFixed(0)}%`}</p></div><div className="flex gap-2"><Button size="sm" variant="secondary" disabled={!compressedFile} onClick={stashToScratchpad} icon={stashed ? <Check className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}>{tr("暂存")}</Button><Button size="sm" disabled={!compressedFile} onClick={downloadImage} icon={<Download className="h-4 w-4" />}>{tr("下载")}</Button></div></div>
          <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2"><div className="workflow-preview flex flex-col"><div className="border-b border-slate-200 bg-white p-3 text-xs">{tr("原图 ·")}{formatBytes(file.size)}</div><div className="flex min-h-52 flex-1 items-center justify-center p-3"><img src={originalUrl} alt={tr("原图")} className="max-h-[55vh] max-w-full object-contain" /></div></div><div className="workflow-preview flex flex-col"><div className="border-b border-slate-200 bg-white p-3 text-xs">{compressedFile ? tr("结果 · ") + (formatBytes(compressedFile.size)) + "" : tr('压缩结果')}</div>{compressedPreviewUrl ? <div className="flex min-h-52 flex-1 items-center justify-center p-3"><img src={compressedPreviewUrl} alt={tr("压缩结果")} className="max-h-[55vh] max-w-full object-contain" /></div> : <WorkflowEmpty title={isCompressing ? tr('正在压缩...') : tr('准备好后点击压缩')} description={tr("完成后可比较画质与文件大小，再下载结果。")} />}</div></div>
        </section>
      </div> : <WorkflowEmpty title={tr("为图片选择合适的体积")} description={tr("网页、平衡和高清预设可快速设置目标大小与边长，也可以手动调整。")} />}
    </CardContent>
  );
};
