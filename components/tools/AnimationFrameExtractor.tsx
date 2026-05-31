import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  FileVideo, 
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

const SCRIPT_URLS = {
  lottie: 'https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie.min.js',
  gifuct: 'https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/dist/gifuct-js.min.js'
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
  new(init: { data: Blob; type: string }): {
    tracks?: { selectedTrack?: { frameCount?: number } };
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

const isImageDecoderEndError = (err: unknown) => {
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  const name = err instanceof Error ? err.name.toLowerCase() : '';
  return name.includes('index') ||
    name.includes('range') ||
    message.includes('frame') ||
    message.includes('index') ||
    message.includes('range') ||
    message.includes('past the end') ||
    message.includes('out of bounds');
};

export const AnimationFrameExtractor: React.FC = () => {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lottieAnimRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playIntervalRef = useRef<any>(null);

  // Global Scratchpad Store
  const stashItem = useScratchpadStore(state => state.addItem);

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
          label: 'Lottie 渲染引擎',
          version: '5.12.2',
          retries: 2,
          timeoutMs: 15000,
          onStatus: handleRuntimeStatus,
        });
      } else {
        await loadScriptWithCache(SCRIPT_URLS.gifuct, {
          label: 'GIF 解码引擎',
          version: '2.1.2',
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
  };

  useEffect(() => () => {
    abortControllerRef.current?.abort();
    exportAbortControllerRef.current?.abort();
    clearFrameObjectUrls();
  }, [clearFrameObjectUrls]);

  const runFrameBatchTask = async (
    kind: FrameBatchState['kind'],
    task: (signal: AbortSignal, update: (current: number, total: number) => void) => Promise<void>,
  ) => {
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

    const decoder = new window.ImageDecoder({ data: uploadedFile, type: mimeType });
    const framePlan = getImageDecoderFramePlan(decoder.tracks?.selectedTrack?.frameCount);
    if (framePlan.frameCount > MAX_DECODED_FRAMES) {
      throw new Error(`检测到 ${framePlan.frameCount} 帧，超过当前安全上限 ${MAX_DECODED_FRAMES} 帧。请截取较短片段后重试。`);
    }
    const parsedFrames: FrameData[] = [];
    let totalPixels = 0;

    try {
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
        const canvas = document.createElement('canvas');
        canvas.width = image.displayWidth;
        canvas.height = image.displayHeight;
        totalPixels += canvas.width * canvas.height;
        if (totalPixels > MAX_TOTAL_PIXELS) {
          image.close();
          throw new Error('累计帧像素过大，已停止解析以保护浏览器内存。');
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('当前浏览器无法创建 Canvas。');
        ctx.drawImage(image, 0, 0);
        const duration = typeof image.duration === 'number' && image.duration > 0
          ? Math.max(16, Math.round(image.duration / 1000))
          : 100;
        image.close();
        parsedFrames.push(await createFrameData(index, canvas, duration));
      }
    } finally {
      decoder.close();
    }

    if (framePlan.frameCountSource === 'probe') {
      setStatus(`帧数探测完成，共检测到 ${parsedFrames.length} 帧。`);
    }

    return parsedFrames;
  };

  // Main file uploader parser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

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
        const text = await uploadedFile.text();
        const lottieJson = JSON.parse(text);
        
        // Render offscreen Lottie container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          const lottieContainer = document.createElement('div');
          lottieContainer.style.width = '512px';
          lottieContainer.style.height = '512px';
          lottieContainer.style.display = 'none';
          containerRef.current.appendChild(lottieContainer);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const anim = (window as any).lottie.loadAnimation({
            container: lottieContainer,
            renderer: 'canvas',
            loop: false,
            autoplay: false,
            animationData: lottieJson
          });

          anim.addEventListener('DOMLoaded', () => {
            const framesCount = Math.round(anim.totalFrames);
            setTotalFrames(framesCount);
            setFps(anim.frameRate || 30);
            lottieAnimRef.current = anim;
            
            // Render first frame on load
            setTimeout(() => {
              renderLottieFrame(0);
              setIsExtracting(false);
              setStatus('Lottie 动画加载就绪');
            }, 100);
          });
        }
      } catch (err) {
        setStatus('解析 Lottie 格式失败: ' + (err as Error).message);
        setIsExtracting(false);
      }
    } else if (ext === 'gif') {
      setFileType('gif');
      try {
        await initDependencies('gif');
        const arrayBuffer = await uploadedFile.arrayBuffer();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gif = new (window as any).Gifuct(arrayBuffer);
        const rawFrames = gif.decompressFrames(true);

        if (!rawFrames || rawFrames.length === 0) {
          throw new Error('GIF 文件中未检测到有效帧');
        }

        if (rawFrames.length > MAX_DECODED_FRAMES) {
          throw new Error(`检测到 ${rawFrames.length} 帧，超过当前安全上限 ${MAX_DECODED_FRAMES} 帧。`);
        }
        const parsedFrames: FrameData[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        let totalPixels = 0;

        // Render each frame offscreen to save as base64 images
        for (let i = 0; i < rawFrames.length; i++) {
          if (abortController.signal.aborted) throw new DOMException('用户已取消解析', 'AbortError');
          const rawFrame = rawFrames[i];
          canvas.width = rawFrame.dims.width;
          canvas.height = rawFrame.dims.height;
          totalPixels += canvas.width * canvas.height;
          if (totalPixels > MAX_TOTAL_PIXELS) {
            throw new Error('累计帧像素过大，已停止解析以保护浏览器内存。');
          }
          
          const imgData = ctx.createImageData(rawFrame.dims.width, rawFrame.dims.height);
          imgData.data.set(rawFrame.patch);
          ctx.putImageData(imgData, 0, 0);

          parsedFrames.push(await createFrameData(i, canvas, rawFrame.delay || 100));
        }

        setDecodedFrames(parsedFrames);
        setTotalFrames(parsedFrames.length);
        const avgDelay = parsedFrames[0]?.delayMs || 100;
        setFps(Math.round(1000 / avgDelay));
        setCurrentFrame(0);
        
        // Draw first frame
        setTimeout(() => {
          renderGifFrame(0, parsedFrames);
          setIsExtracting(false);
          setStatus('GIF 动图帧解析完成');
        }, 100);

      } catch (err) {
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
        setDecodedFrames(parsedFrames);
        setTotalFrames(parsedFrames.length);
        const avgDelay = parsedFrames[0]?.delayMs || 100;
        setFps(Math.max(1, Math.round(1000 / avgDelay)));
        setCurrentFrame(0);
        setTimeout(() => {
          renderGifFrame(0, parsedFrames);
          setIsExtracting(false);
          setStatus(`${ext === 'webp' ? 'WebP' : 'APNG'} 动画帧解析完成`);
        }, 100);
      } catch (err) {
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

    const img = new Image();
    img.onload = () => {
      const previewCanvas = previewCanvasRef.current!;
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
    const frameNum = parseInt(e.target.value, 10);
    setCurrentFrame(frameNum);
    
    if (fileType === 'lottie') {
      renderLottieFrame(frameNum);
    } else {
      renderGifFrame(frameNum);
    }
  };

  // Play / Pause loop controller
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.round(1000 / fps);
      playIntervalRef.current = setInterval(() => {
        setCurrentFrame(prev => {
          const next = prev >= totalFrames - 1 ? 0 : prev + 1;
          if (fileType === 'lottie') {
            renderLottieFrame(next);
          } else {
            renderGifFrame(next);
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, totalFrames, fps, fileType, renderLottieFrame, renderGifFrame]);

  // Single Frame export / stashing to Global Scratchpad drawer
  const handleStashFrame = async () => {
    if (!previewCanvasRef.current || !file) return;

    previewCanvasRef.current.toBlob((blob) => {
      if (blob) {
        const baseName = file.name.split('.').shift() || 'animation';
        const name = `${baseName}_frame_${String(currentFrame + 1).padStart(3, '0')}.png`;
        
        stashItem(name, blob, 'image', 'image/png');
        setStashedIndex(currentFrame);
        setTimeout(() => setStashedIndex(null), 1500);
      }
    }, 'image/png');
  };

  // Stash ALL frames to Global Scratchpad
  const handleStashAllFrames = async () => {
    if (!file || totalFrames === 0) return;
    setStatus('正在将所有帧推送到全局暂存箱，请稍候...');

    try {
      const baseName = sanitizeArchiveFileName(file.name.split('.').shift() || 'animation');

      await runFrameBatchTask('stashScratchpad', async (signal, update) => {
        if (fileType === 'gif' || fileType === 'webp' || fileType === 'apng') {
          for (const frame of frames) {
            if (signal.aborted) throw new DOMException('用户已取消批量暂存', 'AbortError');
            const blob = await getFrameBlob(frame);
            const name = `${baseName}_frame_${String(frame.index + 1).padStart(3, '0')}.png`;
            await useScratchpadStore.getState().addItemAsync(name, blob, 'image', 'image/png');
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
                await useScratchpadStore.getState().addItemAsync(name, blob, 'image', 'image/png');
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
      if ((err as Error).name !== 'AbortError') alert(message);
    }
  };

  // Single Frame local download
  const handleDownloadFrame = () => {
    if (!previewCanvasRef.current || !file) return;

    previewCanvasRef.current.toBlob((blob) => {
      if (blob) {
        const baseName = file.name.split('.').shift() || 'animation';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}_frame_${String(currentFrame + 1).padStart(3, '0')}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  };

  // Export ALL frames as ZIP archive
  const handleExportAllZip = async () => {
    if (!file || totalFrames === 0) return;
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
      if ((err as Error).name !== 'AbortError') alert(message);
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="动图与 Lottie 动画帧提取工坊"
        description="本地提取 GIF、APNG、WebP 动图及 Lottie JSON 动画文件的每一个关键帧，支持可视化逐帧时间轴精细预览及批量打包。"
      />
      <CardContent className="flex-1 flex flex-col gap-6 overflow-auto min-h-0">
        
        {/* Upload Zone */}
        <div className="relative flex-none p-6 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/40 flex flex-col items-center justify-center gap-3 text-center hover:bg-slate-100 dark:hover:bg-slate-900/60 transition-colors shadow-xs">
          <div className="p-3 bg-white dark:bg-slate-950 rounded-full shadow-md">
            <FileVideo className="w-8 h-8 text-primary-500 animate-bounce" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">上传 GIF / APNG / WebP 动图 或 Lottie JSON 文件</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">本地读取，完全保护个人创意安全，无需传输服务器</p>
          </div>
          <input
            type="file"
            accept=".gif,.apng,.png,.webp,.json,image/gif,image/png,image/webp,application/json"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFileChange}
          />
        </div>

        {/* Dynamic loading states */}
        {isExtracting && (
          <div className="max-w-md mx-auto w-full p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl flex items-center gap-3 shadow-xs">
            <RefreshCw className="w-5 h-5 text-primary-500 animate-spin shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{status}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {frameBatch
                  ? `${frameBatch.kind === 'exportZip' ? 'ZIP 导出' : '批量暂存'}：${frameBatch.current}/${frameBatch.total} (${frameBatch.progress}%)`
                  : '正在使用 Canvas / WebCodecs 管道提取帧，已启用内存预算保护'}
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
              取消
            </button>
          </div>
        )}

        {extractError && !isExtracting && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <div className="font-bold">动画解析未完成</div>
            <p className="mt-1 leading-5">{extractError}</p>
            <p className="mt-1 leading-5">如果是 APNG/WebP，请确认浏览器支持 WebCodecs ImageDecoder；大尺寸或超长动画建议先裁剪后再导入。</p>
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
                  <span className="font-mono">帧率: {fps} FPS</span>
                  {frames[currentFrame] && (
                    <span className="font-mono text-slate-400">{frames[currentFrame].delayMs} ms · {frames[currentFrame].width}x{frames[currentFrame].height}</span>
                  )}
                  <span className="font-mono text-primary-600 dark:text-primary-400">FRAME {currentFrame + 1} / {totalFrames}</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max={totalFrames - 1}
                    value={currentFrame}
                    onChange={handleScrubChange}
                    className="w-full accent-primary-600 cursor-pointer h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg"
                  />
                </div>

                {/* Control Panel Buttons */}
                <div className="flex justify-center items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      const next = currentFrame === 0 ? totalFrames - 1 : currentFrame - 1;
                      setCurrentFrame(next);
                      if (fileType === 'lottie') renderLottieFrame(next);
                      else renderGifFrame(next);
                    }}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                    title="前一帧"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow transition-all active:scale-95"
                    title={isPlaying ? '暂停' : '播放'}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  <button
                    onClick={() => {
                      const next = currentFrame === totalFrames - 1 ? 0 : currentFrame + 1;
                      setCurrentFrame(next);
                      if (fileType === 'lottie') renderLottieFrame(next);
                      else renderGifFrame(next);
                    }}
                    className="p-2 hover:bg-slate-50 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                    title="后一帧"
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
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">导出当前选定帧</h3>
                </div>
                <p className="text-[11px] text-slate-400">
                  当前处于动画第 <span className="font-bold text-primary-600">{currentFrame + 1}</span> 帧。点击以下操作将该单帧导出为透明 PNG 图像。
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleStashFrame}
                    variant="secondary"
                    icon={stashedIndex === currentFrame ? <Check className="w-4 h-4 text-green-500" /> : <ClipboardList className="w-4 h-4" />}
                  >
                    {stashedIndex === currentFrame ? '已送入暂存箱' : '送入暂存箱'}
                  </Button>
                  <Button
                    onClick={handleDownloadFrame}
                    icon={<Download className="w-4 h-4" />}
                  >
                    下载单帧 PNG
                  </Button>
                </div>
              </div>

              {/* Bulk exports card */}
              <div className="p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-sm space-y-4 flex-none">
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-5 h-5 text-primary-500" />
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">批量帧打包导出</h3>
                </div>
                <p className="text-[11px] text-slate-400">
                  一键渲染、压缩并打包动画的全部 <span className="font-bold text-primary-600">{totalFrames}</span> 个关键帧。
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    onClick={handleStashAllFrames}
                    variant="secondary"
                    icon={stashedAll ? <Check className="w-4 h-4 text-green-500" /> : <ClipboardList className="w-4 h-4" />}
                    disabled={isExtracting}
                  >
                    {stashedAll ? '全帧已暂存' : '全帧送入暂存箱'}
                  </Button>
                  <Button
                    onClick={handleExportAllZip}
                    disabled={isExtracting}
                    icon={<FolderArchive className="w-4 h-4" />}
                  >
                    打包 ZIP 下载
                  </Button>
                </div>
              </div>

              {/* Information board */}
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-xs text-blue-800 flex-1 overflow-auto max-h-[160px]">
                <Info className="w-4.5 h-4.5 mt-0.5 shrink-0" />
                <div className="space-y-1 leading-normal">
                  <h4 className="font-bold">本地运行提示</h4>
                  <p>1. 本工具使用 CDN 动态缓存引擎，首次加载可能会有数秒延迟，成功载入后将自动缓存在本地实现秒级离线冷启动。</p>
                  <p>2. 支持 stashing 机制，已导出的 PNG 单帧可以立刻通过“送入暂存箱”同步到全局 Drawer 中，打通所有图形图像工具链。</p>
                </div>
              </div>

            </div>

          </div>
        )}

        {!file && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 text-xs gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 dark:bg-slate-900/10 min-h-[300px]">
            <AlertCircle className="w-12 h-12 stroke-1 text-slate-300 dark:text-slate-800" />
            <span className="font-bold">等待上传解析文件</span>
            <p className="text-[10px] text-slate-500 text-center max-w-[260px] leading-relaxed">
              支持上传标准 GIF、APNG、animated WebP 或 Lottie JSON。APNG/WebP 依赖浏览器 WebCodecs ImageDecoder 能力，不支持时会给出明确降级提示。
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default AnimationFrameExtractor;
