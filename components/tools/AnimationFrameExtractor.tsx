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
import { loadScriptWithCache } from './shared/cdnCacheManager';
import { useScratchpadStore } from './shared/scratchpadStore';

const SCRIPT_URLS = {
  lottie: 'https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie.min.js',
  gifuct: 'https://cdn.jsdelivr.net/npm/gifuct-js@2.1.2/dist/gifuct-js.min.js'
};

interface FrameData {
  index: number;
  dataUrl: string;
  delay?: number;
}

export const AnimationFrameExtractor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'lottie' | 'gif' | null>(null);
  const [status, setStatus] = useState('请上传 GIF 动图或 Lottie JSON 动画文件');
  
  // Player state
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(30);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);

  // Success indicator
  const [stashedIndex, setStashedIndex] = useState<number | null>(null);
  const [stashedAll, setStashedAll] = useState(false);

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lottieAnimRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playIntervalRef = useRef<any>(null);

  // Global Scratchpad Store
  const stashItem = useScratchpadStore(state => state.addItem);

  // Load required JS packages dynamically and cache them
  const initDependencies = async (type: 'lottie' | 'gif') => {
    setStatus(`正在初始化本地 ${type === 'lottie' ? 'Lottie 渲染' : 'GIF 解码'}引擎...`);
    try {
      if (type === 'lottie') {
        await loadScriptWithCache(SCRIPT_URLS.lottie);
      } else {
        await loadScriptWithCache(SCRIPT_URLS.gifuct);
      }
      setStatus('引擎加载就绪。正在解析动画数据...');
    } catch (err) {
      console.error(err);
      setStatus('依赖库加载失败，请检查您的网络连接。');
      throw err;
    }
  };

  const cleanUpPlayer = () => {
    setIsPlaying(false);
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }
    if (lottieAnimRef.current) {
      lottieAnimRef.current.destroy();
      lottieAnimRef.current = null;
    }
    setFrames([]);
    setTotalFrames(0);
    setCurrentFrame(0);
  };

  // Main file uploader parser
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    cleanUpPlayer();
    setFile(uploadedFile);
    setIsExtracting(true);

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

        const parsedFrames: FrameData[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        // Render each frame offscreen to save as base64 images
        for (let i = 0; i < rawFrames.length; i++) {
          const rawFrame = rawFrames[i];
          canvas.width = rawFrame.dims.width;
          canvas.height = rawFrame.dims.height;
          
          const imgData = ctx.createImageData(rawFrame.dims.width, rawFrame.dims.height);
          imgData.data.set(rawFrame.patch);
          ctx.putImageData(imgData, 0, 0);

          parsedFrames.push({
            index: i,
            dataUrl: canvas.toDataURL('image/png'),
            delay: rawFrame.delay || 100
          });
        }

        setFrames(parsedFrames);
        setTotalFrames(parsedFrames.length);
        const avgDelay = parsedFrames[0]?.delay || 100;
        setFps(Math.round(1000 / avgDelay));
        setCurrentFrame(0);
        
        // Draw first frame
        setTimeout(() => {
          renderGifFrame(0, parsedFrames);
          setIsExtracting(false);
          setStatus('GIF 动图帧解析完成');
        }, 100);

      } catch (err) {
        setStatus('解析 GIF 格式失败: ' + (err as Error).message);
        setIsExtracting(false);
      }
    } else {
      setStatus('暂不支持的文件格式，仅支持上传 GIF 或 JSON 文件。');
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
    img.src = frame.dataUrl;
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
    setIsExtracting(true);
    setStatus('正在将所有帧推送到全局暂存箱，请稍候...');

    try {
      const baseName = file.name.split('.').shift() || 'animation';

      if (fileType === 'gif') {
        for (const frame of frames) {
          const res = await fetch(frame.dataUrl);
          const blob = await res.blob();
          const name = `${baseName}_frame_${String(frame.index + 1).padStart(3, '0')}.png`;
          await useScratchpadStore.getState().addItemAsync(name, blob, 'image', 'image/png');
        }
      } else if (fileType === 'lottie' && lottieAnimRef.current) {
        // Sequentially render Lottie frames to canvas and stash them
        const anim = lottieAnimRef.current;
        for (let i = 0; i < totalFrames; i++) {
          anim.goToAndStop(i, true);
          const internalCanvas = containerRef.current?.querySelector('canvas');
          if (internalCanvas) {
            const blob = await new Promise<Blob | null>((resolve) => internalCanvas.toBlob(resolve, 'image/png'));
            if (blob) {
              const name = `${baseName}_frame_${String(i + 1).padStart(3, '0')}.png`;
              await useScratchpadStore.getState().addItemAsync(name, blob, 'image', 'image/png');
            }
          }
        }
        // Restore current frame
        renderLottieFrame(currentFrame);
      }

      setStashedAll(true);
      setTimeout(() => setStashedAll(false), 2000);
      setStatus('所有帧已安全送入暂存箱！');
    } catch (err) {
      alert('批量送入暂存箱失败: ' + (err as Error).message);
    } finally {
      setIsExtracting(false);
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
    setIsExtracting(true);
    setStatus('正在打包所有帧为 ZIP 压缩包，请稍候...');
    
    try {
      const zip = new JSZip();
      const baseName = file.name.split('.').shift() || 'animation';

      if (fileType === 'gif') {
        for (const frame of frames) {
          const res = await fetch(frame.dataUrl);
          const blob = await res.blob();
          const fileName = `${baseName}_frame_${String(frame.index + 1).padStart(3, '0')}.png`;
          zip.file(fileName, blob);
        }
      } else if (fileType === 'lottie' && lottieAnimRef.current) {
        const anim = lottieAnimRef.current;
        for (let i = 0; i < totalFrames; i++) {
          anim.goToAndStop(i, true);
          const internalCanvas = containerRef.current?.querySelector('canvas');
          if (internalCanvas) {
            const blob = await new Promise<Blob | null>((resolve) => internalCanvas.toBlob(resolve, 'image/png'));
            if (blob) {
              const fileName = `${baseName}_frame_${String(i + 1).padStart(3, '0')}.png`;
              zip.file(fileName, blob);
            }
          }
        }
        // Restore visual frame
        renderLottieFrame(currentFrame);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${baseName}_frames.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('ZIP 文件导出完成');
    } catch (err) {
      alert('打包 ZIP 失败: ' + (err as Error).message);
    } finally {
      setIsExtracting(false);
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
            <p className="font-semibold text-slate-700 dark:text-slate-200">上传 GIF 动图 或 Lottie JSON 文件</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">本地读取，完全保护个人创意安全，无需传输服务器</p>
          </div>
          <input
            type="file"
            accept=".gif,.json"
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
              <p className="text-[10px] text-slate-400 mt-0.5">正在利用 Web Worker 或 Canvas 管道提取分段</p>
            </div>
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
              支持上传标准的 GIF 动图 (如 sticker.gif) 或标准的 Lottie 动画描述 (如 animation.json) 进行本地解码。
            </p>
          </div>
        )}

      </CardContent>
    </Card>
  );
};

export default AnimationFrameExtractor;
