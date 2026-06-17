import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, Image as ImageIcon, Upload } from 'lucide-react';
import { CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { notifyToast } from '../shared/notifyToast';
import { sanitizeSvgMarkup } from '../shared/sanitizeMarkup';
import { useScratchpadStore } from '../shared/scratchpadStore';
import { downloadBlob, getBaseName } from './imageToolUtils';
import { runMarchingEdges } from './vectorizerCore';

// --- Image Vectorizer Panel (Grayscale Marching Edges) ---
export const ImageVectorizerPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [simplifyTolerance, setSimplifyTolerance] = useState(0.5);
  const [invert, setInvert] = useState(false);
  const [fillColor, setFillColor] = useState('#0f172a');
  const [bgColor, setBgColor] = useState('transparent');
  const [svgPath, setSvgPath] = useState('');
  const [svgWidth, setSvgWidth] = useState(0);
  const [svgHeight, setSvgHeight] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
      setSvgPath('');
    }
  };

  const rawSvgContent = useMemo(
    () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="background-color: ${bgColor};">\n  <path d="${svgPath}" fill="${fillColor}" fill-rule="evenodd" />\n</svg>`,
    [bgColor, fillColor, svgHeight, svgPath, svgWidth],
  );
  const safeSvgContent = useMemo(
    () => (svgPath ? sanitizeSvgMarkup(rawSvgContent) : ''),
    [rawSvgContent, svgPath],
  );

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(safeSvgContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadSvg = () => {
    const blob = new Blob([safeSvgContent], { type: 'image/svg+xml' });
    const name = file ? getBaseName(file.name) : 'vectorized';
    downloadBlob(blob, `${name}.svg`);
  };

  const sendSvgToScratchpad = async () => {
    if (!svgPath) return;
    try {
      await useScratchpadStore.getState().addItemAsync({
        name: `${file ? getBaseName(file.name) : 'vectorized'}.svg`,
        content: safeSvgContent,
        type: 'svg',
        mimeType: 'image/svg+xml',
        sourceTool: '图片矢量化',
        originAction: 'vectorize-svg',
      });
      notifyToast({ title: 'SVG 已送入暂存箱', tone: 'success' });
    } catch (err) {
      notifyToast({
        title: '送入暂存箱失败',
        description: err instanceof Error ? err.message : '浏览器本地存储不可用，请清理空间后重试。',
        tone: 'error',
      });
    }
  };

  const handleVectorize = useCallback(() => {
    if (!previewUrl) return;
    setIsProcessing(true);

    const img = new Image();
    img.onload = () => {
      const maxSide = 600;
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > maxSide || h > maxSide) {
        if (w > h) {
          h = Math.round((h * maxSide) / w);
          w = maxSide;
        } else {
          w = Math.round((w * maxSide) / h);
          h = maxSide;
        }
      }

      setSvgWidth(w);
      setSvgHeight(h);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      const path = runMarchingEdges(canvas, threshold, invert, simplifyTolerance);
      setSvgPath(path);
      setIsProcessing(false);
    };
    img.src = previewUrl;
  }, [invert, previewUrl, simplifyTolerance, threshold]);

  useEffect(() => {
    if (previewUrl) {
      Promise.resolve().then(handleVectorize);
    }
  }, [handleVectorize, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <CardContent className="flex-1 flex flex-col lg:flex-row gap-6 overflow-auto p-6 min-h-0 text-slate-700 dark:text-slate-200">
      <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
        {!previewUrl ? (
          <div 
            onClick={() => document.getElementById('vector-file')?.click()}
            className="flex-1 min-h-[220px] border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:border-primary-500 hover:bg-slate-50 dark:hover:bg-slate-900/10 transition-all"
          >
            <input 
              type="file" id="vector-file" className="hidden" 
              accept="image/*" onChange={handleFileChange}
            />
            <Upload className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">选择本地位图进行矢量化</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">支持 PNG, JPG, WEBP • 纯本地离线计算</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3 text-xs">
              <ImageIcon className="w-8 h-8 text-primary-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{file?.name}</p>
                <p className="text-[10px] text-slate-500">尺寸: {svgWidth} x {svgHeight} px</p>
              </div>
              <button
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  setSvgPath('');
                }}
                className="text-[10px] text-rose-500 font-bold hover:underline"
              >
                移除
              </button>
            </div>

            <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>二值化阈值 (Threshold)</span>
                <span className="font-mono text-primary-500">{threshold}</span>
              </div>
              <input 
                type="range" min="0" max="255" value={threshold} 
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-full accent-primary-500"
              />
              <p className="text-[9px] text-slate-500">数值越低提取线条越细，数值越高填充面积越大。</p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between font-bold text-slate-700 dark:text-slate-300">
                <span>平滑化程度 (Simplify)</span>
                <span className="font-mono text-primary-500">{simplifyTolerance}px</span>
              </div>
              <input 
                type="range" min="0" max="3" step="0.1" value={simplifyTolerance} 
                onChange={e => setSimplifyTolerance(Number(e.target.value))}
                className="w-full accent-primary-500"
              />
              <p className="text-[9px] text-slate-500">过滤锯齿边缘波动，数值越高线条越平滑。</p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3 text-xs">
              <label className="flex items-center gap-2 font-bold cursor-pointer text-slate-700 dark:text-slate-300">
                <input 
                  type="checkbox" checked={invert} onChange={e => setInvert(e.target.checked)}
                  className="rounded text-primary-500 focus:ring-primary-400"
                />
                <span>反转颜色区域 (Inverting)</span>
              </label>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="space-y-1">
                  <span className="text-slate-500 block">前景填充颜色</span>
                  <div className="flex items-center gap-1.5">
                    <input 
                      type="color" value={fillColor.startsWith('#') ? fillColor : '#000000'} 
                      onChange={e => setFillColor(e.target.value)}
                      className="w-6 h-6 border-0 rounded cursor-pointer"
                    />
                    <input 
                      type="text" value={fillColor} onChange={e => setFillColor(e.target.value)}
                      className="w-full border rounded px-1 py-0.5 font-mono text-[9px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 block">背景背景颜色</span>
                  <select 
                    value={bgColor} onChange={e => setBgColor(e.target.value)}
                    className="w-full border rounded px-1 py-0.5 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px]"
                  >
                    <option value="transparent">透明背景</option>
                    <option value="#ffffff">白色白色</option>
                    <option value="#f8fafc">浅灰背景</option>
                    <option value="#0f172a">深蓝背景</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleDownloadSvg} icon={<Download className="w-4 h-4"/>}>
                下载 SVG
              </Button>
              <Button variant="secondary" onClick={sendSvgToScratchpad}>
                送入暂存箱
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950 min-h-[300px]">
        <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-none">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {showCode ? 'SVG 矢量源码' : '无损 SVG 预览'}
            </span>
            {isProcessing && <span className="text-[10px] text-primary-500 font-bold animate-pulse">矢量化计算中...</span>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCode(!showCode)}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border rounded px-2.5 py-1 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            >
              {showCode ? '图形预览' : '查看源码'}
            </button>
            {svgPath && (
              <button
                onClick={handleCopyCode}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border rounded px-2.5 py-1 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                <span>复制代码</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 p-6 flex items-center justify-center overflow-auto min-h-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]">
          {!previewUrl ? (
            <div className="text-slate-400 text-center text-xs">
              <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-800 mx-auto mb-3" />
              <span>上传位图图像，在此实时生成并预览高阶矢量化路径。</span>
            </div>
          ) : showCode ? (
            <pre className="w-full h-full p-4 rounded-xl border border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-950 font-mono text-[10px] text-slate-700 dark:text-slate-300 overflow-auto whitespace-pre leading-relaxed">
              {safeSvgContent}
            </pre>
          ) : svgPath ? (
            <div 
              className="max-w-full max-h-full aspect-square border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow flex items-center justify-center"
              style={{
                width: `${svgWidth}px`,
                height: `${svgHeight}px`,
                backgroundColor: bgColor
              }}
              dangerouslySetInnerHTML={{ __html: safeSvgContent }}
            />
          ) : (
            <div className="text-slate-400 text-center text-xs animate-pulse">
              <span>正在追踪位图边缘...</span>
            </div>
          )}
        </div>
      </div>
    </CardContent>
  );
};
