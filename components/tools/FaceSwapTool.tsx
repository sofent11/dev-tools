import React, { useState, useEffect } from 'react';
import FaceSwapCanvas from './faceswap-core/components/FaceSwapCanvas';
import { processModelImage, processSourceImage } from './faceswap-core/utils/faceProcessor';
import { ModelFacePack, SourceFacePack } from './faceswap-core/types';
import { MODELS, SOURCES } from './faceswap-core/utils/mockData';

/**
 * Wrapper component that integrates faceswap-core as a tool panel.
 * Dynamically loads external dependencies (MediaPipe, Delaunator).
 */

const SCRIPT_URLS = {
  faceMesh: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js',
  delaunator: 'https://cdn.jsdelivr.net/npm/delaunator@5.0.0/delaunator.min.js'
};

// Helper to load external scripts
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

export const FaceSwapTool: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [scriptsError, setScriptsError] = useState<string | null>(null);
  
  const [modelPack, setModelPack] = useState<ModelFacePack>(MODELS[0]);
  const [sourcePack, setSourcePack] = useState<SourceFacePack>(SOURCES[0]);
  
  const [isProcessingModel, setIsProcessingModel] = useState(false);
  const [isProcessingSource, setIsProcessingSource] = useState(false);
  const [error, setError] = useState('');

  // Load external scripts on mount
  useEffect(() => {
    const loadDependencies = async () => {
      try {
        await Promise.all([
          loadScript(SCRIPT_URLS.faceMesh),
          loadScript(SCRIPT_URLS.delaunator)
        ]);
        setIsLoading(false);
      } catch (err: any) {
        setScriptsError(err.message);
        setIsLoading(false);
      }
    };
    loadDependencies();
  }, []);

  const handleBaseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsProcessingModel(true);
    setError('');
    try {
      const url = URL.createObjectURL(e.target.files[0]);
      const pack = await processModelImage(url);
      setModelPack(pack);
    } catch (err: any) {
      setError("基础图片错误: " + err.message);
    } finally {
      setIsProcessingModel(false);
    }
  };

  const handleFaceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    setIsProcessingSource(true);
    setError('');
    try {
      const url = URL.createObjectURL(e.target.files[0]);
      const pack = await processSourceImage(url);
      setSourcePack(pack);
    } catch (err: any) {
      setError("人脸图片错误: " + err.message);
    } finally {
      setIsProcessingSource(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-500">加载 MediaPipe 人脸识别模型...</p>
        </div>
      </div>
    );
  }

  if (scriptsError) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center p-6 bg-red-50 border border-red-200 rounded-lg max-w-md">
          <p className="text-red-600 font-medium mb-2">加载依赖失败</p>
          <p className="text-red-500 text-sm">{scriptsError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 p-4 overflow-auto bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl">
      
      {/* Sidebar Controls */}
      <div className="w-full lg:w-80 flex-shrink-0 space-y-6">
        <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-5">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1">
            FaceMorpheus
          </h2>
          <p className="text-xs text-slate-400 mb-6">本地 WebGL 换脸工具</p>

          {/* Step 1: Base Image */}
          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">1. 基础照片</label>
              {isProcessingModel && <span className="text-xs text-blue-400 animate-pulse">处理中...</span>}
            </div>
            
            <div className="relative group cursor-pointer">
              <div className="w-full aspect-[4/3] bg-black/50 rounded-lg overflow-hidden border-2 border-dashed border-slate-600 group-hover:border-blue-500 transition-colors">
                <img src={modelPack.imageUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className="bg-black/70 text-white px-3 py-1 rounded text-sm font-medium backdrop-blur-sm">
                     更换基础照片
                   </span>
                </div>
              </div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleBaseUpload} />
            </div>
          </div>

          {/* Step 2: Face Image */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
               <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">2. 替换人脸</label>
               {isProcessingSource && <span className="text-xs text-blue-400 animate-pulse">处理中...</span>}
            </div>

            <div className="relative group cursor-pointer">
              <div className="w-full aspect-square bg-black/50 rounded-lg overflow-hidden border-2 border-dashed border-slate-600 group-hover:border-purple-500 transition-colors">
                 <img src={sourcePack.textureUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
                 <div className="absolute inset-0 flex items-center justify-center">
                   <span className="bg-black/70 text-white px-3 py-1 rounded text-sm font-medium backdrop-blur-sm">
                     更换人脸
                   </span>
                </div>
              </div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleFaceUpload} />
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-500/50 rounded text-red-200 text-xs">
              {error}
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 text-center">
          使用 MediaPipe & WebGL 本地运行
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 min-h-[400px] lg:min-h-0 flex items-center justify-center">
        <div className="relative max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden border border-white/10 bg-slate-900" 
             style={{ 
               aspectRatio: `${modelPack.width} / ${modelPack.height}`,
               width: 'min(100%, 700px)' 
             }}>
          <FaceSwapCanvas 
            model={modelPack} 
            source={sourcePack} 
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default FaceSwapTool;
