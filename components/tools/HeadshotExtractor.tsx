import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { FaceDetector, FilesetResolver, Detection } from '@mediapipe/tasks-vision';
import { Upload, Download, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

export const HeadshotExtractor: React.FC = () => {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Waiting for models to load...');
  const imgRef = useRef<HTMLImageElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // MediaPipe references
  const faceDetectorRef = useRef<FaceDetector | null>(null);
  const isModelLoadingRef = useRef(false);

  useEffect(() => {
    initMediaPipe();
  }, []);

  const initMediaPipe = async () => {
    if (faceDetectorRef.current || isModelLoadingRef.current) return;
    
    isModelLoadingRef.current = true;
    setStatus('Loading AI models...');
    
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      
      faceDetectorRef.current = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "GPU"
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.2 // Lowered for better sensitivity in full-body shots
      });
      
      setStatus('Ready. Please select an image.');
    } catch (error) {
      console.error('Error loading MediaPipe:', error);
      setStatus('Failed to load AI models. Please check your connection.');
    } finally {
      isModelLoadingRef.current = false;
    }
  };

  const calculateSmartCrop = (box: {x: number, y: number, width: number, height: number}, imgWidth: number, imgHeight: number): Crop => {
    // 1. Constants per specification
    const R = 0.50; // Face height / Crop height
    const FACE_CENTER_BIAS_Y = 0.55; // Face center Y position in crop (0-1)
    const SCALE = 1.06; // Slight zoom out to include hair

    const { x, y, width: w, height: h } = box;

    // 2. Calculate crop size (Side length S)
    // S = (h / r) * scale
    let s = (h / R) * SCALE;

    // 3. Calculate crop center
    const centerX = x + w / 2;
    const centerY = y + h * FACE_CENTER_BIAS_Y;

    // 4. Calculate initial bounds
    let left = centerX - s / 2;
    let top = centerY - s / 2;

    // 5. Constrain size to image dimensions
    const maxS = Math.min(imgWidth, imgHeight);
    if (s > maxS) {
        s = maxS;
        // Recalculate left/top with new size, keeping center
        left = centerX - s / 2;
        top = centerY - s / 2;
    }

    // 6. Clamp to boundaries (shift if needed)
    // Shift right if off-screen left
    if (left < 0) {
        left = 0;
    }
    // Shift left if off-screen right
    if (left + s > imgWidth) {
        left = imgWidth - s;
    }
    // Shift down if off-screen top
    if (top < 0) {
        top = 0;
    }
    // Shift up if off-screen bottom
    if (top + s > imgHeight) {
        top = imgHeight - s;
    }

    return {
        unit: 'px',
        x: left,
        y: top,
        width: s,
        height: s,
    };
  };

  const detectFace = async (img: HTMLImageElement | HTMLCanvasElement): Promise<Detection | null> => {
    if (!faceDetectorRef.current) {
        console.warn('Face detector not initialized');
        return null;
    }

    try {
        const result = faceDetectorRef.current.detect(img);
        if (result.detections.length > 0) {
            return result.detections[0];
        }
        return null;
    } catch (e) {
        console.error("Detection error:", e);
        return null;
    }
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); 
      setCompletedCrop(undefined);
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

    // Wait for model if it's not ready yet
    if (!faceDetectorRef.current) {
        setIsLoading(true);
        setStatus('Waiting for AI model...');
        while (!faceDetectorRef.current && isModelLoadingRef.current) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    if (!faceDetectorRef.current) {
        setStatus('AI Model failed to load.');
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setStatus('Detecting face...');

    // Small delay to let UI render the status change
    await new Promise<void>((r) => window.setTimeout(r, 10));

    try {
      let detection = await detectFace(img);
      let mappedBox: {x: number, y: number, width: number, height: number} | null = null;

      if (detection && detection.boundingBox) {
        const box = detection.boundingBox;
        const scaleX = displayWidth / img.naturalWidth;
        const scaleY = displayHeight / img.naturalHeight;
        mappedBox = {
            x: box.originX * scaleX,
            y: box.originY * scaleY,
            width: box.width * scaleX,
            height: box.height * scaleY
        };
      } else {
        // Fallback: Detection failed on full image. 
        // Try detecting on the upper 70% of the image (common in full-body shots)
        // to make the face appear "larger" relative to the detector input.
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const cropHeight = img.naturalHeight * 0.7;
            canvas.width = img.naturalWidth;
            canvas.height = cropHeight;
            ctx.drawImage(img, 0, 0, img.naturalWidth, cropHeight, 0, 0, img.naturalWidth, cropHeight);
            
            setStatus('Retrying detection on upper body...');
            detection = await detectFace(canvas);
            
            if (detection && detection.boundingBox) {
                const box = detection.boundingBox;
                const scaleX = displayWidth / img.naturalWidth;
                const scaleY = displayHeight / img.naturalHeight;
                mappedBox = {
                    x: box.originX * scaleX,
                    y: box.originY * scaleY,
                    width: box.width * scaleX,
                    height: box.height * scaleY
                };
            }
        }
      }
      
      if (mappedBox) {
        const newCrop = calculateSmartCrop(mappedBox, displayWidth, displayHeight);
        
        setCrop(newCrop);
        setCompletedCrop({
          unit: 'px',
          x: newCrop.x,
          y: newCrop.y,
          width: newCrop.width,
          height: newCrop.height,
        });
        setStatus('Face detected and auto-cropped.');
      } else {
        setStatus('No face detected. Please select crop area manually.');
        // Default center crop
         const defaultCrop: Crop = {
            unit: 'px',
            x: (displayWidth - displayWidth * 0.5) / 2,
            y: (displayHeight - displayWidth * 0.5) / 2,
            width: displayWidth * 0.5,
            height: displayWidth * 0.5
        };
        setCrop(defaultCrop);
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

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(pixelRatio, pixelRatio);
      ctx.imageSmoothingQuality = 'high';

      const cropX = crop.x * scaleX;
      const cropY = crop.y * scaleY;

      ctx.save();
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
        description="自动定位头部与肩部，支持人工微调裁剪 (Powered by MediaPipe)"
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

