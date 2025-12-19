import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import * as faceapi from 'face-api.js';
import { Upload, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

export const HeadshotExtractor: React.FC = () => {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Waiting for image...');
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      setStatus('Loading models...');
      // Load from public/models
      await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
      setStatus('Models loaded. Ready.');
    } catch (e) {
      console.error(e);
      setStatus('Error loading models.');
    }
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
    const { width, height } = e.currentTarget;
    const img = e.currentTarget;

    // Auto-detect face
    setIsLoading(true);
    setStatus('Detecting face...');
    try {
        const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions());

        if (detections.length > 0) {
            // Pick the largest face
            const face = detections.reduce((prev, current) => (prev.box.area > current.box.area) ? prev : current);
            const box = face.box;

            // Heuristic for Head to Shoulder
            // Face box covers usually the face from forehead to chin.
            // Head top is slightly above (hair).
            // Shoulders are below chin.

            // Adjust box:
            // Top: move up by 50% of height (for hair)
            // Bottom: move down by 100% of height (for neck and shoulders)
            // Left/Right: widen by 50% of width each side

            let newX = box.x - box.width * 0.5;
            let newY = box.y - box.height * 0.5;
            let newW = box.width * 2.0;
            let newH = box.height * 2.5;

            // Constrain to image bounds
            if (newX < 0) newX = 0;
            if (newY < 0) newY = 0;
            if (newX + newW > width) newW = width - newX;
            if (newY + newH > height) newH = height - newY;

            // Create crop object (percentage or pixels). react-image-crop uses pixels or percent.
            // We'll use pixels here but convert to structure ReactCrop expects.

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
        } else {
            setStatus('No face detected. Please select manually.');
            // Default center crop
            const newCrop = centerCrop(
                makeAspectCrop(
                    {
                        unit: '%',
                        width: 50,
                    },
                    1, // aspect
                    width,
                    height
                ),
                width,
                height
            );
            setCrop(newCrop);
            setCompletedCrop(newCrop);
        }

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
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
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
