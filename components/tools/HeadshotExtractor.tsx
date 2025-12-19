import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import * as faceapi from 'face-api.js';
import { Upload, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

type DetectResult = {
  box: faceapi.Box;
  inputWidth: number;
  inputHeight: number;
};

export const HeadshotExtractor: React.FC = () => {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Waiting for image...');
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const ssdLoadedRef = useRef(false);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    if (loadPromiseRef.current) {
      return loadPromiseRef.current;
    }

    loadPromiseRef.current = (async () => {
      try {
        setStatus('Loading models...');
        // TinyFaceDetector: 快、轻量，适合前端交互。
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        setStatus('Models loaded. Ready.');
      } catch (e) {
        console.error(e);
        setStatus('Error loading models.');
      }
    })();

    return loadPromiseRef.current;
  };

  const loadSsdModelIfNeeded = async () => {
    if (ssdLoadedRef.current) {
      return;
    }
    try {
      setStatus('Loading fallback model...');
      await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
      ssdLoadedRef.current = true;
    } catch (e) {
      console.error(e);
    }
  };

  const runWhenIdle = (fn: () => void) => {
    if ('requestIdleCallback' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).requestIdleCallback(fn, { timeout: 800 });
    } else {
      window.setTimeout(fn, 0);
    }
  };

  const detectFaceFast = async (img: HTMLImageElement): Promise<DetectResult | null> => {
    // 关键优化：先缩放再检测，避免大图直接推理导致卡顿。
    const maxDim = 640;
    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    if (!naturalWidth || !naturalHeight) {
      return null;
    }

    const scale = Math.min(1, maxDim / Math.max(naturalWidth, naturalHeight));
    const inputWidth = Math.max(1, Math.round(naturalWidth * scale));
    const inputHeight = Math.max(1, Math.round(naturalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = inputWidth;
    canvas.height = inputHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return null;
    }

    ctx.drawImage(img, 0, 0, inputWidth, inputHeight);

    const detection = await faceapi.detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({
        // inputSize 越大越准越慢；416 在大多数机器上是不错的平衡。
        inputSize: 416,
        // 白底证件照/磨皮可能让置信度偏低，适当降低阈值提高召回。
        scoreThreshold: 0.2,
      }),
    );

    if (!detection) {
      return null;
    }

    return { box: detection.box, inputWidth, inputHeight };
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Makes crop preview update between images
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || ''),
      );
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const onImageLoad = async (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const displayWidth = img.width;
    const displayHeight = img.height;

    setIsLoading(true);
    setStatus('Detecting face...');

    // 让“加载中”状态先渲染出来，避免看起来“卡住”。
    await new Promise<void>((r) => window.setTimeout(r, 0));

    try {
      await loadModels();

      const fast = await detectFaceFast(img);
      if (fast) {
        const { box, inputWidth, inputHeight } = fast;
        // 将检测坐标（缩放输入）映射到显示坐标（ReactCrop 以显示尺寸为基准）
        const sx = displayWidth / inputWidth;
        const sy = displayHeight / inputHeight;

        const mappedBox = new faceapi.Box(
          box.x * sx,
          box.y * sy,
          box.width * sx,
          box.height * sy,
        );

        let newW = mappedBox.width * 2.0;
        let newH = mappedBox.height * 2.2;

        let newX = mappedBox.x + mappedBox.width / 2 - newW / 2;
        let newY = mappedBox.y - mappedBox.height * 0.8;

        if (newX < 0) newX = 0;
        if (newY < 0) newY = 0;
        if (newX + newW > displayWidth) newX = Math.max(0, displayWidth - newW);
        if (newY + newH > displayHeight) newY = Math.max(0, displayHeight - newH);

        if (newX + newW > displayWidth) newW = displayWidth - newX;
        if (newY + newH > displayHeight) newH = displayHeight - newY;

        const newCrop: Crop = {
          unit: 'px',
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        };
        setCrop(newCrop);
        setCompletedCrop({
          unit: 'px',
          x: newX,
          y: newY,
          width: newW,
          height: newH,
        });
        setStatus('Face detected and auto-cropped.');
        return;
      }

      // 快速模型没识别到：先给用户一个可用的默认裁剪框，再在空闲时尝试更强模型兜底。
      setStatus('No face detected. Using default crop; trying fallback...');
      const defaultCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 50,
          },
          1,
          displayWidth,
          displayHeight,
        ),
        displayWidth,
        displayHeight,
      );
      setCrop(defaultCrop);
      setCompletedCrop(defaultCrop);

      runWhenIdle(async () => {
        try {
          await loadSsdModelIfNeeded();
          if (!ssdLoadedRef.current) {
            setStatus('Fallback model unavailable. Please crop manually.');
            return;
          }

          const detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }));
          if (!detection) {
            setStatus('No face detected. Please select manually.');
            return;
          }

          const box = detection.box;
          let newW = box.width * 2.0;
          let newH = box.height * 2.2;

          let newX = box.x + box.width / 2 - newW / 2;
          let newY = box.y - box.height * 0.8;

          if (newX < 0) newX = 0;
          if (newY < 0) newY = 0;
          if (newX + newW > displayWidth) newX = Math.max(0, displayWidth - newW);
          if (newY + newH > displayHeight) newY = Math.max(0, displayHeight - newH);

          if (newX + newW > displayWidth) newW = displayWidth - newX;
          if (newY + newH > displayHeight) newH = displayHeight - newY;

          const newCrop: Crop = {
            unit: 'px',
            x: newX,
            y: newY,
            width: newW,
            height: newH,
          };
          setCrop(newCrop);
          setCompletedCrop({
            unit: 'px',
            x: newX,
            y: newY,
            width: newW,
            height: newH,
          });
          setStatus('Face detected (fallback) and auto-cropped.');
        } catch (err) {
          console.error(err);
          setStatus('Detection failed. Please select manually.');
        }
      });
    } catch (err) {
      console.error(err);
      setStatus('Detection failed. Please select manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const onDownloadCrop = () => {
    if (!completedCrop || !previewCanvasRef.current) {
        return;
    }

    const canvas = previewCanvasRef.current;

    // Convert canvas to blob
    canvas.toBlob((blob) => {
        if (!blob) {
            console.error('Canvas is empty');
            return;
        }
        const previewUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.download = 'headshot.png';
        anchor.href = previewUrl;
        anchor.click();
        window.URL.revokeObjectURL(previewUrl);
    }, 'image/png');
  };

  // Effect to update canvas when crop changes
  useEffect(() => {
    if (
      completedCrop?.width &&
      completedCrop?.height &&
      imgRef.current &&
      previewCanvasRef.current
    ) {
      // We use the canvasUtils or similar logic here directly
      const image = imgRef.current;
      const canvas = previewCanvasRef.current;
      const crop = completedCrop;

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return;
      }

      const pixelRatio = window.devicePixelRatio;

      canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
      canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

      // 重要：避免多次 effect 调用导致 scale 叠加
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = 'high';

      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;

      ctx.save();

      // Move the crop origin to the canvas origin (0,0)
      ctx.translate(-cropX, -cropY);

      ctx.drawImage(
        image,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
        0,
        0,
        image.naturalWidth,
        image.naturalHeight,
      );

      ctx.restore();
    }
  }, [completedCrop]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="大头照提取 (Headshot Extraction)"
        description="自动定位头部与肩部，支持人工微调裁剪"
      />
      <CardContent className="flex-1 flex flex-col gap-6 overflow-auto">
        {/* Upload Area */}
        <div className="flex-none p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-4 text-center hover:bg-slate-100 transition-colors">
            <div className="p-4 bg-white rounded-full shadow-sm">
                <Upload className="w-8 h-8 text-primary-500" />
            </div>
            <div>
                <p className="font-medium text-slate-700">点击上传或拖拽图片</p>
                <p className="text-sm text-slate-500">支持 JPG, PNG, WEBP</p>
            </div>
            <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={onSelectFile}
            />
        </div>

        <div className="text-center text-sm text-slate-500">
            {status}
            {isLoading && <RefreshCw className="inline ml-2 w-4 h-4 animate-spin" />}
        </div>

        {imgSrc && (
            <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
                {/* Editor Area */}
                <div className="flex-1 flex items-center justify-center bg-slate-100 rounded-xl border border-slate-200 p-4 overflow-hidden relative">
                    <ReactCrop
                        crop={crop}
                      onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        className="max-h-full"
                    >
                        <img
                            ref={imgRef}
                            alt="Crop me"
                            src={imgSrc}
                            onLoad={onImageLoad}
                            style={{ maxHeight: '60vh', objectFit: 'contain' }}
                        />
                    </ReactCrop>
                </div>

                {/* Preview & Action Area */}
                <div className="w-full md:w-80 flex-none space-y-6">
                    <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
                        <h3 className="font-semibold text-slate-800">预览</h3>
                        <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg p-2 min-h-[150px]">
                            {completedCrop ? (
                                <canvas
                                    ref={previewCanvasRef}
                                    style={{
                                        objectFit: 'contain',
                                        width: completedCrop.width,
                                        height: completedCrop.height,
                                        maxWidth: '100%',
                                        maxHeight: '300px'
                                    }}
                                />
                            ) : (
                                <span className="text-slate-400 text-sm">暂无预览</span>
                            )}
                        </div>
                        <Button onClick={onDownloadCrop} className="w-full" icon={<Download className="w-4 h-4" />}>
                            保存裁剪结果
                        </Button>
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p>
                            系统会自动尝试定位头部和肩部区域。您可以通过拖动选择框来微调位置。
                        </p>
                    </div>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
};
