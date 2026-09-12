import React, { useEffect, useState } from 'react';
import { Check, ClipboardList, Download, FileImage, Image as ImageIcon, RefreshCw, Settings, Upload } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { CardContent } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { notifyToast } from '../shared/notifyToast';
import { useScratchpadStore } from '../shared/scratchpadStore';
import { downloadBlob, formatBytes, getBaseName } from './imageToolUtils';

export const ImageCompressorPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<Blob | null>(null);
  const [compressedPreviewUrl, setCompressedPreviewUrl] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [options, setOptions] = useState({
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'original',
  });

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setFile(event.target.files[0]);
      setCompressedFile(null);
    }
  };

  const handleCompress = async () => {
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressionOptions = {
        maxSizeMB: options.maxSizeMB,
        maxWidthOrHeight: options.maxWidthOrHeight,
        useWebWorker: options.useWebWorker,
        fileType: options.fileType === 'original' ? undefined : options.fileType,
      };

      const compressedBlob = await imageCompression(file, compressionOptions);
      setCompressedFile(compressedBlob);
    } catch (error) {
      console.error(error);
      notifyToast({ title: '图片压缩失败', description: (error as Error).message, tone: 'error' });
    } finally {
      setIsCompressing(false);
    }
  };

  const [stashed, setStashed] = useState(false);

  const stashToScratchpad = async () => {
    if (!compressedFile) return;
    let extension = file?.name.split('.').pop() || 'jpg';
    if (options.fileType !== 'original') {
      extension = options.fileType.split('/')[1];
    }
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
      setStashed(true);
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
    if (options.fileType !== 'original') {
      extension = options.fileType.split('/')[1];
    }

    const name = file ? getBaseName(file.name) : 'image';
    downloadBlob(compressedFile, `${name}_compressed.${extension}`);
  };

  return (
    <CardContent className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="tool-upload flex-none p-6">
        <div className="rounded-full bg-white p-4 shadow-sm">
          <Upload className="w-8 h-8 text-primary-500" />
        </div>
        <div>
          <p className="font-medium text-slate-700">Click to upload or drag and drop</p>
          <p className="text-sm text-slate-500">Supports JPG, PNG, WEBP, BMP</p>
        </div>
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
          <div className="tool-section h-fit w-full flex-none space-y-6 p-4 md:w-80">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Compression Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Size (MB)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={options.maxSizeMB}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      maxSizeMB: Number.parseFloat(e.target.value) || 0.1,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Width/Height (px)</label>
                <input
                  type="number"
                  step="100"
                  value={options.maxWidthOrHeight}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      maxWidthOrHeight: Number.parseInt(e.target.value, 10) || 1920,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Output Format</label>
                <select
                  value={options.fileType}
                  onChange={(e) => setOptions({ ...options, fileType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="original">Keep Original</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/png">PNG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
            </div>

            <Button
              onClick={handleCompress}
              disabled={isCompressing}
              className="w-full"
              icon={isCompressing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            >
              {isCompressing ? 'Compressing...' : 'Compress Image'}
            </Button>
          </div>

          <div className="flex-1 flex flex-col gap-4">
            <div className="tool-panel flex items-center gap-4 p-4">
              <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div>
                <p className="font-medium text-slate-800">{file.name}</p>
                <p className="text-sm text-slate-500">
                  {formatBytes(file.size)} • {file.type}
                </p>
              </div>
            </div>

            {compressedFile && (
              <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                <div className="status-success flex items-center gap-4 p-4">
                  <div className="w-12 h-12 bg-green-100 rounded flex items-center justify-center text-green-600">
                    <FileImage className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-900">Compression Complete!</p>
                    <p className="text-sm text-green-700">
                      {formatBytes(compressedFile.size)}
                      <span className="mx-2 text-green-400">|</span>
                      Saved {((file.size - compressedFile.size) / file.size * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={stashToScratchpad}
                      variant="secondary"
                      icon={stashed ? <Check className="w-4 h-4 text-green-500" /> : <ClipboardList className="w-4 h-4" />}
                    >
                      {stashed ? 'Stashed!' : 'Stash'}
                    </Button>
                    <Button onClick={downloadImage} icon={<Download className="w-4 h-4" />}>
                      Download
                    </Button>
                  </div>
                </div>

                <div className="tool-panel relative flex min-h-[200px] flex-1 items-center justify-center p-4">
                  {compressedPreviewUrl && (
                    <img
                      src={compressedPreviewUrl}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain shadow-lg rounded"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </CardContent>
  );
};
