import { runtimeAsset } from './shared/runtimeAssets';
import { translateUi as tr, useLocaleRender } from '../../src/i18n/render';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Download, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RefreshCw, 
  ClipboardList, 
  Check, 
  AlertCircle, 
  Sparkles, 
  FolderArchive, 
  Info
} from 'lucide-react';
import JSZip from 'jszip';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { loadScriptWithCache, type RemoteRuntimeEvent } from './shared/cdnCacheManager';
import { useScratchpadStore } from './shared/scratchpadStore';
import { notifyToast } from './shared/notifyToast';
import { FileDropzone, WorkflowSteps } from './shared/WorkflowUi';

const SCRIPT_URLS = {
  lottie: runtimeAsset('lottie').url,
  gifuct: runtimeAsset('gifuct').url
};

interface FrameData {
  index: number;
  blob: Blob;
  objectUrl: string;
  delayMs: number;
  width: number;
  height: number;
  dataUrl?: string;
}

interface FrameBatchState {
  kind: 'exportZip' | 'stashScratchpad';
  progress: number;
  current: number;
  total: number;
}

const MAX_DECODED_FRAMES = 500;
const MAX_FRAME_PIXELS = 4096 * 4096;
const MAX_TOTAL_PIXELS = 160_000_000;

interface ImageDecoderConstructor {
  new(init: { data: ArrayBuffer; type: string }): {
    tracks?: { ready?: Promise<void>; selectedTrack?: { frameCount?: number } };
    decode: (options?: { frameIndex?: number }) => Promise<{ image: VideoFrame }>;
    close: () => void;
  };
  isTypeSupported?: (type: string) => Promise<boolean>;
}

declare global {
  interface Window {
    ImageDecoder?: ImageDecoderConstructor;
  }
}

const canvasToBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

const createFrameData = async (index: number, canvas: HTMLCanvasElement, delayMs = 100): Promise<FrameData> => {
  const pixels = canvas.width * canvas.height;
  if (pixels > MAX_FRAME_PIXELS) {
    throw new Error(`单帧尺寸过大 (${canvas.width}x${canvas.height})，为避免浏览器内存暴涨已停止解析。`);
  }
  const blob = await canvasToBlob(canvas);
  if (!blob) throw new Error('帧图像导出失败。');
  return {
    index,
    blob,
    objectUrl: URL.createObjectURL(blob),
    delayMs,
    width: canvas.width,
    height: canvas.height,
  };
};

const getFrameBlob = async (frame: FrameData) => {
  if (frame.blob) return frame.blob;
  if (!frame.dataUrl) throw new Error('帧数据缺失');
  const res = await fetch(frame.dataUrl);
  return res.blob();
};

export const sanitizeArchiveFileName = (name: string) =>
  name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80) || 'animation';

export type ImageDecoderFrameCountSource = 'metadata' | 'probe';

export const getImageDecoderFramePlan = (frameCount?: number): {
  frameCount: number;
  frameCountSource: ImageDecoderFrameCountSource;
} => {
  if (typeof frameCount === 'number' && Number.isFinite(frameCount) && frameCount > 1) {
    return { frameCount, frameCountSource: 'metadata' };
  }
  return { frameCount: MAX_DECODED_FRAMES, frameCountSource: 'probe' };
};

export const isImageDecoderEndError = (err: unknown) => {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const name = err instanceof Error ? err.name.toLowerCase() : '';
  return name === 'indexsizeerror' || name === 'rangeerror' ||
    /(?:frame|index).*(?:out of (?:range|bounds)|past (?:the )?end|exceed)/.test(message) ||
    message.includes('past the end') || message.includes('out of bounds');
};

export const AnimationFrameExtractor: React.FC = () => {
  useLocaleRender();
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'lottie' | 'gif' | 'webp' | 'apng' | null>(null);
  const [status, setStatus] = useState('请上传 GIF 动图或 Lottie JSON 动画文件');
  
  // Player state
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(30);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [frameBatch, setFrameBatch] = useState<FrameBatchState | null>(null);

  // Success indicator
  const [stashedIndex, setStashedIndex] = useState<number | null>(null);
  const [stashedAll, setStashedAll] = useState(false);

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const exportAbortControllerRef = useRef<AbortController | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const previewRequestRef = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lottieAnimRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playIntervalRef = useRef<any>(null);

  // Global Scratchpad Store
  const stashItem = useScratchpadStore(state => state.addItemAsync);

  const clearFrameObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  const setDecodedFrames = useCallback((nextFrames: FrameData[]) => {
    clearFrameObjectUrls();
    objectUrlsRef.current = nextFrames.map(frame => frame.objectUrl);
    setFrames(nextFrames);
  }, [clearFrameObjectUrls]);

  const handleRuntimeStatus = (event: RemoteRuntimeEvent) => {
    if (event.status === 'cached') {
      setStatus(`${event.label} ${event.version || ''} 命中本地缓存，正在启动...`);
    } else if (event.status === 'loading') {
      setStatus(`${event.label} ${event.version || ''} 加载中：${event.message || ''}`);
    } else if (event.status === 'ready') {
      setStatus(`${event.label} ${event.version || ''} 已就绪`);
    } else if (event.status === 'error') {
      setStatus(`${event.label} 加载失败：${event.message || '未知错误'}。正在重试或等待您稍后重试。`);
    }
  };

  // Load required JS packages dynamically and cache them
  const initDependencies = async (type: 'lottie' | 'gif') => {
    setStatus(`正在初始化本地 ${type === 'lottie' ? 'Lottie 渲染' : 'GIF 解码'}引擎...`);
    try {
      if (type === 'lottie') {
        await loadScriptWithCache(SCRIPT_URLS.lottie, {
          expectedSha256: runtimeAsset('lottie').sha256,
          label: 'Lottie 渲染引擎',
          version: runtimeAsset('lottie').version,
          retries: 2,
          timeoutMs: 15000,
          onStatus: handleRuntimeStatus,
        });
      } else {
        await loadScriptWithCache(SCRIPT_URLS.gifuct, {
          expectedSha256: runtimeAsset('gifuct').sha256,
          label: 'GIF 解码引擎',
          version: runtimeAsset('gifuct').version,
          retries: 2,
          timeoutMs: 15000,
          onStatus: handleRuntimeStatus,
        });
      }
      setStatus('引擎加载就绪。正在解析动画数据...');
    } catch (err) {
      console.error(err);
      setStatus('依赖库加载失败，请检查您的网络连接。');
      throw err;
    }
  };

  const cleanUpPlayer = () => {
    previewRequestRef.current += 1;
    abortControllerRef.current?.abort();
    exportAbortControllerRef.current?.abort();
    abortControllerRef.current = null;
    exportAbortControllerRef.current = null;
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    if (lottieAnimRef.current) {
      lottieAnimRef.current.destroy();
      lottieAnimRef.current = null;
    }
    clearFrameObjectUrls();
    setFrames([]);
    setTotalFrames(0);
    setCurrentFrame(0);
    setExtractError('');
    setFrameBatch(null);
    setStashedIndex(null); setStashedAll(false);
  };

  useEffect(() => () => {
    abortControllerRef.current?.abort();
    exportAbortControllerRef.current?.abort();
    previewRequestRef.current += 1;
    lottieAnimRef.current?.destroy();
    clearTimeout(playIntervalRef.current);
    clearFrameObjectUrls();
  }, [clearFrameObjectUrls]);

  const runFrameBatchTask = async (
    kind: FrameBatchState['kind'],
    task: (signal: AbortSignal, update: (current: number, total: number) => void) => Promise<void>,
  ) => {
    clearTimeout(playIntervalRef.current);
    setIsPlaying(false);
    const controller = new AbortController();
    exportAbortControllerRef.current = controller;
    setIsExtracting(true);
    setFrameBatch({ kind, progress: 0, current: 0, total: totalFrames });
    try {
      await task(controller.signal, (current, total) => {
        setFrameBatch({
          kind,
          current,
          total,
          progress: total > 0 ? Math.round((current / total) * 100) : 0,
        });
      });
    } finally {
      if (exportAbortControllerRef.current === controller) {
        exportAbortControllerRef.current = null;
      }
      setFrameBatch(null);
      setIsExtracting(false);
    }
  };

  const decodeAnimatedImageFrames = async (uploadedFile: File, mimeType: string, signal: AbortSignal) => {
    if (!window.ImageDecoder) {
      throw new Error('当前浏览器暂不支持 WebCodecs ImageDecoder，请使用最新版 Chrome/Edge，或改用 GIF/Lottie 文件。');
    }

    const supported = await window.ImageDecoder.isTypeSupported?.(mimeType);
    if (supported === false) {
      throw new Error(`当前浏览器的 ImageDecoder 不支持 ${mimeType} 动图解码。`);
    }

    if (uploadedFile.size > 64 * 1024 * 1024) throw new Error('Animation file limit: 64 MB');
    const decoder = new window.ImageDecoder({ data: await uploadedFile.arrayBuffer(), type: mimeType });
    const parsedFrames: FrameData[] = [];
    let totalPixels = 0;
    let framePlan: ReturnType<typeof getImageDecoderFramePlan>;
    try {
      await decoder.tracks?.ready;
      if (signal.aborted) throw new DOMException('用户已取消解析', 'AbortError');
      framePlan = getImageDecoderFramePlan(decoder.tracks?.selectedTrack?.frameCount);
      if (framePlan.frameCount > MAX_DECODED_FRAMES) {
        throw new Error(`检测到 ${framePlan.frameCount} 帧，超过当前安全上限 ${MAX_DECODED_FRAMES} 帧。请截取较短片段后重试。`);
      }
      for (let index = 0; index < framePlan.frameCount; index += 1) {
        if (signal.aborted) throw new DOMException('用户已取消解析', 'AbortError');
        const totalLabel = framePlan.frameCountSource === 'probe' ? '探测中' : framePlan.frameCount;
        setStatus(`正在${framePlan.frameCountSource === 'probe' ? '探测并' : ''}解码 ${mimeType.includes('webp') ? 'WebP' : 'APNG'} 第 ${index + 1} / ${totalLabel} 帧...`);
        let image: VideoFrame;
        try {
          ({ image } = await decoder.decode({ frameIndex: index }));
        } catch (err) {
          if (framePlan.frameCountSource === 'probe' && index > 0 && isImageDecoderEndError(err)) break;
          throw err;
        }
        try {
          if (image.displayWidth * image.displayHeight > MAX_FRAME_PIXELS) throw new Error('单帧超过像素上限，请缩小后重试。');
          const canvas = document.createElement('canvas');
          canvas.width = image.displayWidth;
          canvas.height = image.displayHeight;
          totalPixels += canvas.width * canvas.height;
          if (totalPixels > MAX_TOTAL_PIXELS) throw new Error('累计帧像素过大，已停止解析以保护浏览器内存。');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('当前浏览器无法创建 Canvas。');
          ctx.drawImage(image, 0, 0);
          const duration = typeof image.duration === 'number' && image.duration > 0
            ? Math.max(16, Math.round(image.duration / 1000)) : 100;
          parsedFrames.push(await createFrameData(index, canvas, duration));
        } finally { image.close(); }
      }
      // A probing decoder must not silently truncate an animation at the safety limit.
      if (framePlan.frameCountSource === 'probe' && parsedFrames.length === MAX_DECODED_FRAMES) {
        let extraFrame: VideoFrame | undefined;
        try { ({ image: extraFrame } = await decoder.decode({ frameIndex: MAX_DECODED_FRAMES })); }
        catch (error) { if (!isImageDecoderEndError(error)) throw error; }
        if (extraFrame) { extraFrame.close(); throw new Error('动画超过 500 帧安全上限，请截取较短片段后重试。'); }
      }
    } catch (error) {
      parsedFrames.forEach(frame => URL.revokeObjectURL(frame.objectUrl));
      throw error;
    } finally {
      decoder.close();
    }

    if (framePlan.frameCountSource === 'probe') {
      setStatus(`帧数探测完成，共检测到 ${parsedFrames.length} 帧。`);
    }

    return parsedFrames;
  };

  // Main file uploader parser
  const handleFileChange = async (files: File[]) => {
    const uploadedFile = files[0];
    if (!uploadedFile || isExtracting || frameBatch) return;
    if (!uploadedFile.size || uploadedFile.size > 64 * 1024 * 1024) { setExtractError('动画文件不能为空，大小不能超过 64 MB。'); return; }

    cleanUpPlayer();
    setFile(uploadedFile);
    setIsExtracting(true);
    setExtractError('');
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const ext = uploadedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'json') {
      setFileType('lottie');
      try {
        await initDependencies('lottie');
        if (abortController.signal.aborted) return;
        const text = await uploadedFile.text();
        if (abortController.signal.aborted) return;
        const lottieJson = JSON.parse(text);
        const frameCount = Math.ceil(Number(lottieJson.op) - Number(lottieJson.ip));
        if (!Number.isFinite(frameCount) || frameCount < 1 || frameCount > MAX_DECODED_FRAMES || !Number.isFinite(lottieJson.fr) || lottieJson.fr <= 0) throw new Error('Lottie 帧数或帧率无效，最多支持 500 帧。');
        if (!Number.isFinite(lottieJson.w) || !Number.isFinite(lottieJson.h) || lottieJson.w <= 0 || lottieJson.h <= 0 || lottieJson.w * lottieJson.h > MAX_FRAME_PIXELS) throw new Error('Lottie 画布尺寸无效或超过像素上限。');
        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';
        const lottieContainer = document.createElement('div');
        lottieContainer.style.width = '512px'; lottieContainer.style.height = '512px'; lottieContainer.style.display = 'none';
        containerRef.current.appendChild(lottieContainer);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anim = (window as any).lottie.loadAnimation({ container: lottieContainer, renderer: 'canvas', loop: false, autoplay: false, animationData: lottieJson });
        lottieAnimRef.current = anim;
        await new Promise<void>((resolve, reject) => {
          const cleanup = () => { clearTimeout(timer); abortController.signal.removeEventListener('abort', abort); anim.removeEventListener('DOMLoaded', ready); anim.removeEventListener('data_failed', failed); };
          const ready = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error('Lottie 渲染失败，请检查动画和素材。')); };
          const abort = () => { cleanup(); anim.destroy(); reject(new DOMException('用户已取消解析', 'AbortError')); };
          const timer = window.setTimeout(() => { cleanup(); reject(new Error('Lottie 初始化超时，请检查动画素材后重试。')); }, 15000);
          anim.addEventListener('DOMLoaded', ready); anim.addEventListener('data_failed', failed); abortController.signal.addEventListener('abort', abort, { once: true });
        });
        if (abortController.signal.aborted || abortControllerRef.current !== abortController) return;
        setTotalFrames(Math.ceil(anim.totalFrames)); setFps(anim.frameRate || 30);
        setTimeout(() => { if (abortController.signal.aborted || abortControllerRef.current !== abortController) return; renderLottieFrame(0); setIsExtracting(false); setStatus('Lottie 动画加载就绪'); }, 100);
      } catch (err) {
        if (abortController.signal.aborted || abortControllerRef.current !== abortController) return;
        lottieAnimRef.current?.destroy(); lottieAnimRef.current = null;
        setExtractError((err as Error).message); setStatus('解析 Lottie 格式失败: ' + (err as Error).message); setIsExtracting(false);
      }
    } else if (ext === 'gif') {
      setFileType('gif');
      const parsedFrames: FrameData[] = [];
      try {
        await initDependencies('gif');
        const arrayBuffer = await uploadedFile.arrayBuffer();
        const api = (window as Window & { gifuct?: typeof import('gifuct-js') }).gifuct;
        if (!api) throw new Error('GIF runtime failed to initialize');
        if (abortController.signal.aborted) return;
        const gif = api.parseGIF(arrayBuffer);
        if (gif.frames.length > MAX_DECODED_FRAMES + 1 || gif.lsd.width * gif.lsd.height > MAX_FRAME_PIXELS) throw new Error('GIF exceeds frame or pixel budget');
        if (gif.frames.length * gif.lsd.width * gif.lsd.height > MAX_TOTAL_PIXELS) throw new Error('GIF exceeds the total pixel budget');
        const rawFrames = api.decompressFrames(gif, true);

        if (!rawFrames || rawFrames.length === 0) {
          throw new Error('GIF 文件中未检测到有效帧');
        }

        if (rawFrames.length > MAX_DECODED_FRAMES) {
          throw new Error(`检测到 ${rawFrames.length} 帧，超过当前安全上限 ${MAX_DECODED_FRAMES} 帧。`);
        }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        let totalPixels = 0;

        // Composite frame patches on the logical screen, honoring GIF disposal modes.
        canvas.width = gif.lsd.width;
        canvas.height = gif.lsd.height;
        if (canvas.width * canvas.height > MAX_FRAME_PIXELS) throw new Error('GIF frame exceeds pixel budget');
        let previous: (typeof rawFrames)[number] | undefined;
        let restore: ImageData | undefined;
        for (let i = 0; i < rawFrames.length; i++) {
          if (abortController.signal.aborted) throw new DOMException('用户已取消解析', 'AbortError');
          if (previous?.disposalType === 2) ctx.clearRect(previous.dims.left, previous.dims.top, previous.dims.width, previous.dims.height);
          else if (previous?.disposalType === 3 && restore) ctx.putImageData(restore, 0, 0);
          const rawFrame = rawFrames[i];
          restore = rawFrame.disposalType === 3 ? ctx.getImageData(0, 0, canvas.width, canvas.height) : undefined;
          totalPixels += canvas.width * canvas.height;
          if (totalPixels > MAX_TOTAL_PIXELS) throw new Error('GIF exceeds the total pixel budget');
          const patch = document.createElement('canvas');
          patch.width = rawFrame.dims.width; patch.height = rawFrame.dims.height;
          const patchContext = patch.getContext('2d');
          if (!patchContext) throw new Error('Canvas is unavailable');
          const pixels = patchContext.createImageData(patch.width, patch.height);
          pixels.data.set(rawFrame.patch);
          patchContext.putImageData(pixels, 0, 0);
          ctx.drawImage(patch, rawFrame.dims.left, rawFrame.dims.top);
          parsedFrames.push(await createFrameData(i, canvas, rawFrame.delay || 100));
          previous = rawFrame;
        }

        if (abortController.signal.aborted || abortControllerRef.current !== abortController) { parsedFrames.forEach(frame => URL.revokeObjectURL(frame.objectUrl)); return; }
        setDecodedFrames(parsedFrames);
        setTotalFrames(parsedFrames.length);
        const avgDelay = parsedFrames.reduce((sum, frame) => sum + frame.delayMs, 0) / parsedFrames.length || 100;
        setFps(Math.round(1000 / avgDelay));
        setCurrentFrame(0);
        
        // Draw first frame
        setTimeout(() => {
          if (abortController.signal.aborted || abortControllerRef.current !== abortController) return;
          renderGifFrame(0, parsedFrames);
          setIsExtracting(false);
          setStatus('GIF 动图帧解析完成');
        }, 100);

      } catch (err) {
        parsedFrames.forEach(frame => URL.revokeObjectURL(frame.objectUrl));
        if (abortController.signal.aborted || abortControllerRef.current !== abortController) return;
        const message = (err as Error).message;
        setExtractError(message);
        setStatus('解析 GIF 格式失败: ' + message);
        setIsExtracting(false);
      }
    } else if (ext === 'webp' || ext === 'png' || ext === 'apng') {
      const mimeType = ext === 'webp' ? 'image/webp' : 'image/png';
      setFileType(ext === 'webp' ? 'webp' : 'apng');
      try {
        setStatus(`正在通过 WebCodecs 解码 ${ext === 'webp' ? 'animated WebP' : 'APNG'}...`);
        const parsedFrames = await decodeAnimatedImageFrames(uploadedFile, mimeType, abortController.signal);
        if (parsedFrames.length === 0) throw new Error('未检测到有效动画帧。');
        if (abortController.signal.aborted || abortControllerRef.current !== abortController) { parsedFrames.forEach(frame => URL.revokeObjectURL(frame.objectUrl)); return; }
        setDecodedFrames(parsedFrames);
        setTotalFrames(parsedFrames.length);
        const avgDelay = parsedFrames.reduce((sum, frame) => sum + frame.delayMs, 0) / parsedFrames.length || 100;
        setFps(Math.max(1, Math.round(1000 / avgDelay)));
        setCurrentFrame(0);
        setTimeout(() => {
          if (abortController.signal.aborted || abortControllerRef.current !== abortController) return;
          renderGifFrame(0, parsedFrames);
          setIsExtracting(false);
          setStatus(`${ext === 'webp' ? 'WebP' : 'APNG'} 动画帧解析完成`);
        }, 100);
      } catch (err) {
        if (abortController.signal.aborted || abortControllerRef.current !== abortController) return;
        const message = (err as Error).message;
        setExtractError(message);
        setStatus(`解析 ${ext === 'webp' ? 'WebP' : 'APNG'} 失败: ${message}`);
        setIsExtracting(false);
      }
    } else {
      const message = '暂不支持的文件格式，仅支持上传 GIF、APNG、WebP 或 Lottie JSON 文件。';
      setExtractError(message);
      setStatus(message);
      setIsExtracting(false);
    }
  };

  // Render Lottie frame to visible preview canvas
  const renderLottieFrame = useCallback((frameNum: number) => {
    if (!lottieAnimRef.current || !previewCanvasRef.current) return;
    const anim = lottieAnimRef.current;
    anim.goToAndStop(frameNum, true);
    
    // Copy the canvas drawn by Lottie renderer inside the offscreen container
    const internalCanvas = containerRef.current?.querySelector('canvas');
    if (internalCanvas) {
      const previewCanvas = previewCanvasRef.current;
      previewCanvas.width = internalCanvas.width;
      previewCanvas.height = internalCanvas.height;
      const ctx = previewCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.drawImage(internalCanvas, 0, 0);
      }
    }
  }, []);

  // Render GIF frame to visible preview canvas
  const renderGifFrame = useCallback((frameNum: number, sourceFrames = frames) => {
    const frame = sourceFrames.find(f => f.index === frameNum);
    if (!frame || !previewCanvasRef.current) return;

    const request = ++previewRequestRef.current;
    const img = new Image();
    img.onload = () => {
      if (request !== previewRequestRef.current || !previewCanvasRef.current) return;
      const previewCanvas = previewCanvasRef.current;
      previewCanvas.width = img.width;
      previewCanvas.height = img.height;
      const ctx = previewCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.drawImage(img, 0, 0);
      }
    };
    img.src = frame.objectUrl || frame.dataUrl || '';
  }, [frames]);

  // Handle Scrub slider events
  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isExtracting) return;
    const frameNum = parseInt(e.target.value, 10);
    setCurrentFrame(frameNum);
    
    if (fileType === 'lottie') {
      renderLottieFrame(frameNum);
    } else {
      renderGifFrame(frameNum);
    }
  };

  // Use each raster frame's duration; Lottie uses its declared frame rate.
  useEffect(() => {
    if (!isPlaying || totalFrames < 2) return;
    const delay = fileType === 'lottie' ? Math.round(1000 / fps) : frames[currentFrame]?.delayMs || 100;
    playIntervalRef.current = setTimeout(() => {
      const next = currentFrame >= totalFrames - 1 ? 0 : currentFrame + 1;
      setCurrentFrame(next);
      if (fileType === 'lottie') renderLottieFrame(next); else renderGifFrame(next);
    }, Math.max(16, delay));
    return () => { clearTimeout(playIntervalRef.current); playIntervalRef.current = null; };
  }, [isPlaying, totalFrames, currentFrame, fps, fileType, frames, renderLottieFrame, renderGifFrame]);

  // Single Frame export / stashing to Global Scratchpad drawer
  const getSelectedFrameBlob = async () => {
    if (fileType !== 'lottie') {
      const frame = frames[currentFrame];
      if (!frame) throw new Error('帧数据缺失');
      return getFrameBlob(frame);
    }
    if (!previewCanvasRef.current) throw new Error('帧数据缺失');
    renderLottieFrame(currentFrame);
    const blob = await canvasToBlob(previewCanvasRef.current);
    if (!blob) throw new Error('帧图像导出失败。');
    return blob;
  };

  const handleStashFrame = async () => {
    if (!file || isExtracting) return;
    try {
      const blob = await getSelectedFrameBlob();
      const baseName = sanitizeArchiveFileName(file.name.replace(/\.[^.]+$/, ''));
      await stashItem(`${baseName}_frame_${String(currentFrame + 1).padStart(3, '0')}.png`, blob, 'image', 'image/png');
      setStashedIndex(currentFrame); setTimeout(() => setStashedIndex(null), 1500);
    } catch (error) { notifyToast({ title: '暂存箱保存失败', description: (error as Error).message, tone: 'error' }); }
  };

  // Stash ALL frames to Global Scratchpad
  const handleStashAllFrames = async () => {
    if (!file || totalFrames === 0 || isExtracting) return;
    setStatus('正在将所有帧推送到全局暂存箱，请稍候...');

    try {
      const baseName = sanitizeArchiveFileName(file.name.split('.').shift() || 'animation');

      await runFrameBatchTask('stashScratchpad', async (signal, update) => {
        if (fileType === 'gif' || fileType === 'webp' || fileType === 'apng') {
          for (const frame of frames) {
            if (signal.aborted) throw new DOMException('用户已取消批量暂存', 'AbortError');
            const blob = await getFrameBlob(frame);
            const name = `${baseName}_frame_${String(frame.index + 1).padStart(3, '0')}.png`;
            await useScratchpadStore.getState().addItemAsync({
              name,
              content: blob,
              type: 'image',
              mimeType: 'image/png',
              sourceTool: '动画帧提取器',
              originAction: 'stash-frame-batch',
            });
            update(frame.index + 1, frames.length);
          }
        } else if (fileType === 'lottie' && lottieAnimRef.current) {
          const anim = lottieAnimRef.current;
          for (let i = 0; i < totalFrames; i++) {
            if (signal.aborted) throw new DOMException('用户已取消批量暂存', 'AbortError');
            anim.goToAndStop(i, true);
            const internalCanvas = containerRef.current?.querySelector('canvas');
            if (internalCanvas) {
              const blob = await new Promise<Blob | null>((resolve) => internalCanvas.toBlob(resolve, 'image/png'));
              if (blob) {
                const name = `${baseName}_frame_${String(i + 1).padStart(3, '0')}.png`;
                await useScratchpadStore.getState().addItemAsync({
                  name,
                  content: blob,
                  type: 'image',
                  mimeType: 'image/png',
                  sourceTool: '动画帧提取器',
                  originAction: 'stash-lottie-frame-batch',
                });
              }
            }
            update(i + 1, totalFrames);
          }
          renderLottieFrame(currentFrame);
        }
      });

      setStashedAll(true);
      setTimeout(() => setStashedAll(false), 2000);
      setStatus('所有帧已安全送入暂存箱！');
    } catch (err) {
      const message = (err as Error).name === 'AbortError' ? '已取消批量送入暂存箱' : '批量送入暂存箱失败: ' + (err as Error).message;
      setStatus(message);
      if ((err as Error).name !== 'AbortError') notifyToast({ title: '批量送入暂存箱失败', description: (err as Error).message, tone: 'error' });
    }
  };

  // Single Frame local download
  const handleDownloadFrame = async () => {
    if (!file || isExtracting) return;
    try {
      const blob = await getSelectedFrameBlob();
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${sanitizeArchiveFileName(file.name.replace(/\.[^.]+$/, ''))}_frame_${String(currentFrame + 1).padStart(3, '0')}.png`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setExtractError((error as Error).message); }
  };

  // Export ALL frames as ZIP archive
  const handleExportAllZip = async () => {
    if (!file || totalFrames === 0 || isExtracting) return;
    setStatus('正在打包所有帧为 ZIP 压缩包，请稍候...');
    
    try {
      const zip = new JSZip();
      const baseName = sanitizeArchiveFileName(file.name.split('.').shift() || 'animation');

      await runFrameBatchTask('exportZip', async (signal, update) => {
        if (fileType === 'gif' || fileType === 'webp' || fileType === 'apng') {
          for (const frame of frames) {
            if (signal.aborted) throw new DOMException('用户已取消 ZIP 导出', 'AbortError');
            const blob = await getFrameBlob(frame);
            const fileName = `${baseName}_frame_${String(frame.index + 1).padStart(3, '0')}.png`;
            zip.file(fileName, blob);
            update(frame.index + 1, frames.length);
          }
        } else if (fileType === 'lottie' && lottieAnimRef.current) {
          const anim = lottieAnimRef.current;
          for (let i = 0; i < totalFrames; i++) {
            if (signal.aborted) throw new DOMException('用户已取消 ZIP 导出', 'AbortError');
            anim.goToAndStop(i, true);
            const internalCanvas = containerRef.current?.querySelector('canvas');
            if (internalCanvas) {
              const blob = await new Promise<Blob | null>((resolve) => internalCanvas.toBlob(resolve, 'image/png'));
              if (blob) {
                const fileName = `${baseName}_frame_${String(i + 1).padStart(3, '0')}.png`;
                zip.file(fileName, blob);
              }
            }
            update(i + 1, totalFrames);
          }
          renderLottieFrame(currentFrame);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        if (signal.aborted) throw new DOMException('用户已取消 ZIP 导出', 'AbortError');
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_frames.zip`;
        a.click();
        URL.revokeObjectURL(url);
      });
      setStatus('ZIP 文件导出完成');
    } catch (err) {
      const message = (err as Error).name === 'AbortError' ? '已取消 ZIP 导出' : '打包 ZIP 失败: ' + (err as Error).message;
      setStatus(message);
      if ((err as Error).name !== 'AbortError') notifyToast({ title: '打包 ZIP 失败', description: (err as Error).message, tone: 'error' });
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title={tr("动图与 Lottie 动画帧提取工坊")}
        description={tr("本地提取 GIF、APNG、WebP 动图及 Lottie JSON 动画文件的每一个关键帧，支持可视化逐帧时间轴精细预览及批量打包。")}
      />
      <CardContent className="flex-1 flex flex-col gap-6 overflow-auto min-h-0">
        
        <WorkflowSteps steps={['选择动画', '浏览时间轴', '导出帧']} active={frameBatch ? 2 : totalFrames ? 1 : 0} />
        <FileDropzone accept=".gif,.apng,.png,.webp,.json,image/gif,image/png,image/webp,application/json" fileName={file?.name} disabled={isExtracting || !!frameBatch} onFiles={handleFileChange} title={tr("选择 GIF / APNG / WebP / Lottie 文件")} hint={tr("本地提取动画帧，支持时间轴预览和 ZIP 导出")} />

        {/* Dynamic loading states */}
        {isExtracting && (
          <div className="max-w-md mx-auto w-full p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl flex items-center gap-3 shadow-xs">
            <RefreshCw className="w-5 h-5 text-primary-500 animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{tr(status)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {frameBatch
                  ? tr(`${frameBatch.kind === 'exportZip' ? 'ZIP 导出' : '批量暂存'}：${frameBatch.current}/${frameBatch.total} (${frameBatch.progress}%)`)
                  : tr('正在使用 Canvas / WebCodecs 管道提取帧，已启用内存预算保护')}
              </p>
              {frameBatch && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-primary-500 transition-all" style={{ width: `${frameBatch.progress}%` }} />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                abortControllerRef.current?.abort();
                exportAbortControllerRef.current?.abort();
                setIsExtracting(false);
                setStatus(frameBatch ? '已取消当前批量任务' : '已取消当前解析任务');
              }}
              className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
            >
              {tr("取消")}</button>
          </div>
        )}

        {extractError && !isExtracting && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <div className="font-bold">{tr("动画解析未完成")}</div>
            <p className="mt-1 leading-5">{tr(extractError)}</p>
            <p className="mt-1 leading-5">{tr("如果是 APNG/WebP，请确认浏览器支持 WebCodecs ImageDecoder；大尺寸或超长动画建议先裁剪后再导入。")}</p>
          </div>
        )}

        {/* Offscreen container for Lottie DOM */}
        <div ref={containerRef} className="hidden" />

        {file && !isExtracting && totalFrames > 0 && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            
            {/* Visual Canvas Canvas Container (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4 min-h-0 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-850 p-4 justify-between">
              
              <div className="flex-1 flex items-center justify-center p-2 min-h-[300px] overflow-hidden">
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-[50vh] object-contain rounded-lg shadow-md bg-checkerboard border border-slate-300 dark:border-slate-800"
                />
              </div>

              {/* Time Scrubber Timeline */}
              <div className="space-y-2 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex-none">
                <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
                  <span className="font-mono">{tr("帧率:")}{fps} FPS</span>
                  {frames[currentFrame] && (
                    <span className="font-mono text-slate-400">{frames[currentFrame].delayMs} ms · {frames[currentFrame].width}x{frames[currentFrame].height}</span>
                  )}
                  <span className="font-mono text-primary-600 dark:text-primary-400">FRAME {currentFrame + 1} / {totalFrames}</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    aria-label={tr("动画时间轴")}
                    type="range"
                    disabled={isExtracting}
                    min="0"
                    max={totalFrames - 1}
                    value={currentFrame}
                    onChange={handleScrubChange}
                    className="w-full accent-primary-600 cursor-pointer h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{tr("时间位置")}<strong data-i18n-skip className="font-mono">{(frames.length ? frames.slice(0, currentFrame).reduce((sum, frame) => sum + frame.delayMs, 0) / 1000 : currentFrame / fps).toFixed(2)} s</strong></span>
                  <label className="flex items-center gap-2">{tr("跳转到帧")}<input aria-label={tr("跳转到帧")} type="number" min={1} max={totalFrames} className="w-20 rounded border border-slate-200 bg-transparent px-2 py-1 font-mono" value={currentFrame + 1} onChange={event => {
                    const next = Math.max(0, Math.min(totalFrames - 1, Math.round(Number(event.target.value) || 1) - 1));
                    setIsPlaying(false); setCurrentFrame(next);
                    if (fileType === 'lottie') renderLottieFrame(next); else renderGifFrame(next);
                  }} /></label>
                </div>
                {/* Control Panel Buttons */}
                <div className="flex justify-center items-center gap-3 pt-2">
                  <button
                    disabled={isExtracting}
                    onClick={() => {
                      const next = currentFrame === 0 ? totalFrames - 1 : currentFrame - 1;
                      setCurrentFrame(next);
                      if (fileType === 'lottie') renderLottieFrame(next);
                      else renderGifFrame(next);
                    }}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                    title={tr("前一帧")}
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    disabled={isExtracting}
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow transition-all active:scale-95"
                    title={tr(isPlaying ? '暂停' : '播放')}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  <button
                    disabled={isExtracting}
                    onClick={() => {
                      const next = currentFrame === totalFrames - 1 ? 0 : currentFrame + 1;
                      setCurrentFrame(next);
                      if (fileType === 'lottie') renderLottieFrame(next);
                      else renderGifFrame(next);
                    }}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                    title={tr("后一帧")}
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Frame Manager / Actions Panel (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4 min-h-0">
              
              {/* Active frame export card */}
              <div className="p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4 flex-none">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary-500" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{tr("导出当前选定帧")}</h3>
                </div>
                <p className="text-[11px] text-slate-400">
                  {tr("当前处于动画第")}<span className="font-bold text-primary-600">{currentFrame + 1}</span> {tr("帧。点击以下操作将该单帧导出为透明 PNG 图像。")}</p>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    disabled={isExtracting}
                    onClick={handleStashFrame}
                    variant="secondary"
                    icon={stashedIndex === currentFrame ? <Check className="w-4 h-4 text-green-500" /> : <ClipboardList className="w-4 h-4" />}
                  >
                    {stashedIndex === currentFrame ? tr('已送入暂存箱') : tr('送入暂存箱')}
                  </Button>
                  <Button
                    disabled={isExtracting}
                    onClick={() => void handleDownloadFrame()}
                    icon={<Download className="w-4 h-4" />}
                  >
                    {tr("下载单帧 PNG")}</Button>
                </div>
              </div>

              {/* Bulk exports card */}
              <div className="p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4 flex-none">
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-primary-500" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{tr("批量帧打包导出")}</h3>
                </div>
                <p className="text-[11px] text-slate-400">
                  {tr("一键渲染、压缩并打包动画的全部")}<span className="font-bold text-primary-600">{totalFrames}</span> {tr("个关键帧。")}</p>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleStashAllFrames}
                    variant="secondary"
                    icon={stashedAll ? <Check className="w-4 h-4 text-green-500" /> : <ClipboardList className="w-4 h-4" />}
                    disabled={isExtracting}
                  >
                    {stashedAll ? tr('全帧已暂存') : tr('全帧送入暂存箱')}
                  </Button>
                  <Button
                    onClick={handleExportAllZip}
                    disabled={isExtracting}
                    icon={<FolderArchive className="w-4 h-4" />}
                  >
                    {tr("打包 ZIP 下载")}</Button>
                </div>
              </div>

              {/* Information board */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-xs text-blue-800 flex-1 overflow-auto max-h-[160px]">
                <Info className="w-4.5 h-4.5 mt-0.5 shrink-0" />
                <div className="space-y-1 leading-normal">
                  <h4 className="font-bold">{tr("本地运行提示")}</h4>
                  <p>{tr("1. 解码引擎随站点部署，加载时校验 SHA-256；缓存不可用时仍可直接加载本站资源。")}</p>
                  <p>{tr("2. 支持 stashing 机制，已导出的 PNG 单帧可以立刻通过“送入暂存箱”同步到全局 Drawer 中，打通所有图形图像工具链。")}</p>
                </div>
              </div>

            </div>

          </div>
        )}

        {!file && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-xs gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 dark:bg-slate-900/10 min-h-[300px]">
            <AlertCircle className="w-12 h-12 stroke-1 text-slate-300 dark:text-slate-800" />
            <span className="font-bold">{tr("等待上传解析文件")}</span>
            <p className="text-[10px] text-slate-500 text-center max-w-[260px] leading-relaxed">
              {tr("支持上传标准 GIF、APNG、animated WebP 或 Lottie JSON。APNG/WebP 依赖浏览器 WebCodecs ImageDecoder 能力，不支持时会给出明确降级提示。")}</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default AnimationFrameExtractor;
