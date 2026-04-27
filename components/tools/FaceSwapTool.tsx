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

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

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
            } catch (err) {
                setScriptsError(getErrorMessage(err));
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
        } catch (err) {
            setError("基础图片错误: " + getErrorMessage(err));
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
        } catch (err) {
            setError("人脸图片错误: " + getErrorMessage(err));
        } finally {
            setIsProcessingSource(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
                    <p className="text-slate-500">加载 MediaPipe 人脸识别模型...</p>
                </div>
            </div>
        );
    }

    if (scriptsError) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="status-error max-w-md p-6 text-center">
                    <p className="text-red-600 font-medium mb-2">加载依赖失败</p>
                    <p className="text-red-500 text-sm">{scriptsError}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:flex-row">

            {/* Sidebar Controls */}
            <div className="w-full flex-shrink-0 space-y-4 lg:w-80">
                <div className="tool-panel p-5">
                    <h2 className="text-lg font-semibold tracking-normal text-slate-950">
                        FaceMorpheus
                    </h2>
                    <p className="mb-5 text-xs font-medium text-slate-500">本地 WebGL 换脸工具</p>

                    {/* Step 1: Base Image */}
                    <div className="mb-5 space-y-3">
                        <div className="flex justify-between items-center">
                            <label className="text-sm font-semibold text-slate-700">1. 基础照片</label>
                            {isProcessingModel && <span className="animate-pulse text-xs text-primary-600">处理中...</span>}
                        </div>

                        <div className="relative group cursor-pointer">
                            <div className="w-full aspect-[4/3] overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-100 transition-colors group-hover:border-primary-400 group-hover:bg-primary-50">
                                <img src={modelPack.imageUrl} className="w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-60" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm">
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
                            <label className="text-sm font-semibold text-slate-700">2. 替换人脸</label>
                            {isProcessingSource && <span className="animate-pulse text-xs text-primary-600">处理中...</span>}
                        </div>

                        <div className="relative group cursor-pointer">
                            <div className="w-full aspect-square overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-100 transition-colors group-hover:border-primary-400 group-hover:bg-primary-50">
                                <img src={sourcePack.textureUrl} className="w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-60" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="rounded-lg border border-slate-200 bg-white/90 px-3 py-1 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm">
                                        更换人脸
                                    </span>
                                </div>
                            </div>
                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleFaceUpload} />
                        </div>
                    </div>

                    {error && (
                        <div className="status-error mt-4 p-3 text-xs">
                            {error}
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs text-slate-500">
                    使用 MediaPipe & WebGL 本地运行
                </div>
            </div>

            {/* Main Preview Area */}
            <div className="flex min-h-[400px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 lg:min-h-0">
                <div className="relative max-h-full max-w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
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
