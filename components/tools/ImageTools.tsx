import React, { useState } from 'react';
import { Upload, Image as ImageIcon, Download, Settings, RefreshCw, FileImage } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

// --- Helper: Format Bytes ---
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const ImageTools: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [compressedFile, setCompressedFile] = useState<Blob | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [options, setOptions] = useState({
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'original' // 'original', 'image/jpeg', 'image/png', 'image/webp'
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setCompressedFile(null); // Reset previous result
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
        fileType: options.fileType === 'original' ? undefined : options.fileType
      };

      const compressedBlob = await imageCompression(file, compressionOptions);
      setCompressedFile(compressedBlob);
    } catch (error) {
      console.error(error);
      alert('Compression failed: ' + (error as Error).message);
    } finally {
      setIsCompressing(false);
    }
  };

  const downloadImage = () => {
    if (!compressedFile) return;
    const url = URL.createObjectURL(compressedFile);
    const link = document.createElement('a');
    link.href = url;

    // Determine extension
    let ext = file?.name.split('.').pop() || 'jpg';
    if (options.fileType !== 'original') {
        ext = options.fileType.split('/')[1];
    }
    const name = file?.name.substring(0, file.name.lastIndexOf('.')) || 'image';
    link.download = `${name}_compressed.${ext}`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Image Compressor & Converter"
        description="Compress images and convert formats locally."
      />
      <CardContent className="flex-1 flex flex-col gap-6 overflow-auto">

        {/* Upload Area */}
        <div className="flex-none p-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-4 text-center hover:bg-slate-100 transition-colors">
            <div className="p-4 bg-white rounded-full shadow-sm">
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

        {/* Settings & Preview */}
        {file && (
            <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">

                {/* Settings Panel */}
                <div className="w-full md:w-80 flex-none space-y-6 p-4 bg-white border border-slate-200 rounded-xl shadow-sm h-fit">
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
                                onChange={(e) => setOptions({...options, maxSizeMB: parseFloat(e.target.value)})}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Max Width/Height (px)</label>
                            <input
                                type="number"
                                step="100"
                                value={options.maxWidthOrHeight}
                                onChange={(e) => setOptions({...options, maxWidthOrHeight: parseInt(e.target.value)})}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Output Format</label>
                            <select
                                value={options.fileType}
                                onChange={(e) => setOptions({...options, fileType: e.target.value})}
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

                {/* Preview Panel */}
                <div className="flex-1 flex flex-col gap-4">
                     {/* Original Info */}
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400">
                            <ImageIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="font-medium text-slate-800">{file.name}</p>
                            <p className="text-sm text-slate-500">{formatBytes(file.size)} • {file.type}</p>
                        </div>
                    </div>

                    {/* Result Info */}
                    {compressedFile && (
                         <div className="flex-1 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg border border-green-200">
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
                                <Button onClick={downloadImage} icon={<Download className="w-4 h-4" />}>
                                    Download
                                </Button>
                            </div>

                            <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center p-4 relative min-h-[200px]">
                                <img
                                    src={URL.createObjectURL(compressedFile)}
                                    alt="Preview"
                                    className="max-w-full max-h-full object-contain shadow-lg rounded"
                                />
                            </div>
                         </div>
                    )}
                </div>
            </div>
        )}

      </CardContent>
    </Card>
  );
};
