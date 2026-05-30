import React, { useState } from 'react';
import {
  FileText,
  Merge,
  Trash2,
  Image as ImageIcon,
  RotateCw,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { TabButton, Tabs } from '../ui/ToolUi';
import type { PDFDocument } from 'pdf-lib';

const loadPdfJs = async () => {
  const pdfjsLib = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.worker.min.mjs';
  return pdfjsLib;
};

interface PdfPageItem {
  id: string;
  file: File;
  fileName: string;
  pageIndex: number; // 0-indexed
  rotation: number;  // 0, 90, 180, 270
  thumbnailSrc: string;
}

export const PdfTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'merge' | 'toImage'>('merge');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="PDF 视觉工作室"
        description="支持 PDF 多文档页面级拆分、可视化卡片排序、90° 旋转、删除与极速混编导出。"
      />
      <Tabs>
        <TabButton active={activeTab === 'merge'} onClick={() => setActiveTab('merge')}>
          PDF 混编与合并
        </TabButton>
        <TabButton active={activeTab === 'toImage'} onClick={() => setActiveTab('toImage')}>
          PDF 转图片
        </TabButton>
      </Tabs>
      <CardContent className="flex-1 overflow-auto p-0 bg-slate-50 dark:bg-slate-950">
        {activeTab === 'merge' ? <PdfMergeTool /> : <PdfToImageTool />}
      </CardContent>
    </Card>
  );
};

const PdfMergeTool: React.FC = () => {
  const [pages, setPages] = useState<PdfPageItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsLoading(true);
    try {
      const pdfjsLib = await loadPdfJs();
      const addedFiles = Array.from(e.target.files);
      const newPages: PdfPageItem[] = [];

      for (const file of addedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.35 }); // Low scale for fast previews
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            const thumbnailSrc = canvas.toDataURL('image/jpeg', 0.8);
            newPages.push({
              id: `${file.name}-${i}-${Date.now()}-${Math.random()}`,
              file,
              fileName: file.name,
              pageIndex: i - 1, // 0-indexed
              rotation: 0,
              thumbnailSrc,
            });
          }
        }
      }

      setPages(prev => [...prev, ...newPages]);
    } catch (err) {
      alert('加载 PDF 页面失败：' + (err as Error).message);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const rotatePage = (id: string, dir: 'left' | 'right') => {
    setPages(prev =>
      prev.map(p => {
        if (p.id === id) {
          let nextRotation = p.rotation + (dir === 'right' ? 90 : -90);
          if (nextRotation < 0) nextRotation += 360;
          nextRotation = nextRotation % 360;
          return { ...p, rotation: nextRotation };
        }
        return p;
      })
    );
  };

  const deletePage = (id: string) => {
    setPages(prev => prev.filter(p => p.id !== id));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    setPages(prev => {
      const nextPages = [...prev];
      const targetIndex = index + direction;
      if (targetIndex >= 0 && targetIndex < nextPages.length) {
        [nextPages[index], nextPages[targetIndex]] = [nextPages[targetIndex], nextPages[index]];
      }
      return nextPages;
    });
  };

  const clearAllPages = () => {
    setPages([]);
  };

  const mergePdfs = async () => {
    if (pages.length === 0) return;
    setIsMerging(true);
    try {
      const { PDFDocument, degrees } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();
      const fileCache = new Map<File, PDFDocument>();

      for (const pageItem of pages) {
        let sourcePdf = fileCache.get(pageItem.file);
        if (!sourcePdf) {
          const arrayBuffer = await pageItem.file.arrayBuffer();
          sourcePdf = await PDFDocument.load(arrayBuffer);
          fileCache.set(pageItem.file, sourcePdf);
        }

        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [pageItem.pageIndex]);
        if (pageItem.rotation !== 0) {
          copiedPage.setRotation(degrees(pageItem.rotation));
        }
        mergedPdf.addPage(copiedPage);
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `compiled_${new Date().getTime()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('混编导出 PDF 失败: ' + (e as Error).message);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      
      {/* Upload Banner */}
      <div className="tool-upload p-8 relative border-dashed border-2 border-slate-300 dark:border-slate-800 rounded-xl hover:border-primary-500 transition-colors bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-primary-50 dark:bg-primary-950 p-4 shadow-inner mb-3">
          <Merge className="w-8 h-8 text-primary-500" />
        </div>
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-200">
            {isLoading ? '解析 PDF 文档中，请稍候...' : '添加并混编 PDF 文件'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            支持拖拽或多选，文档会自动按页拆分为可视化卡片
          </p>
        </div>
        {!isLoading && (
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFiles}
          />
        )}
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <Loader2 className="w-7 h-7 text-primary-600 animate-spin" />
          </div>
        )}
      </div>

      {pages.length > 0 && (
        <div className="space-y-4">
          
          {/* Action Header bar */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary-500" />
                页面大纲混编区
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                当前共拆分出 <span className="font-bold text-primary-600">{pages.length}</span> 个页面卡片，右侧操作合并
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={clearAllPages}>清空页面</Button>
              <Button
                onClick={mergePdfs}
                disabled={isMerging}
                isLoading={isMerging}
                icon={<Merge className="w-4 h-4" />}
              >
                开始混编并导出 PDF
              </Button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
              >
                {/* Visual Thumbnail Frame */}
                <div className="aspect-[1/1.4] bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-3 relative overflow-hidden flex-1 select-none">
                  <div className="w-full h-full relative flex items-center justify-center">
                    <img
                      src={p.thumbnailSrc}
                      alt={`Page ${p.pageIndex + 1}`}
                      className="max-w-full max-h-full object-contain rounded shadow-sm"
                      style={{
                        transform: `rotate(${p.rotation}deg)`,
                        transition: 'transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    />
                  </div>
                  
                  {/* Floating Page number pill */}
                  <span className="absolute bottom-2 left-2 text-[9px] font-extrabold bg-slate-900/75 dark:bg-slate-800/80 backdrop-blur-md text-white px-2 py-0.5 rounded-full">
                    {idx + 1}
                  </span>
                </div>

                {/* Info and action panel */}
                <div className="p-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate" title={p.fileName}>
                      {p.fileName}
                    </div>
                    <div className="text-[9px] text-slate-400 font-semibold">
                      原第 {p.pageIndex + 1} 页 {p.rotation > 0 ? `· 旋转 ${p.rotation}°` : ''}
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="grid grid-cols-5 gap-0.5 border-t border-slate-200/50 dark:border-slate-800/50 pt-1.5">
                    <button
                      onClick={() => movePage(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex justify-center text-slate-500 disabled:opacity-20 transition-colors"
                      title="向前移动"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => rotatePage(p.id, 'left')}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex justify-center text-slate-500 transition-colors"
                      title="向左旋转 90°"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => rotatePage(p.id, 'right')}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex justify-center text-slate-500 transition-colors"
                      title="向右旋转 90°"
                    >
                      <RotateCw className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => movePage(idx, 1)}
                      disabled={idx === pages.length - 1}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex justify-center text-slate-500 disabled:opacity-20 transition-colors"
                      title="向后移动"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deletePage(p.id)}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/30 rounded flex justify-center text-red-500 transition-colors"
                      title="删除该页"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PdfToImageTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setImages([]);
    }
  };

  const convert = async () => {
    if (!file) return;
    setIsConverting(true);
    setImages([]);

    try {
      const pdfjsLib = await loadPdfJs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const newImages: string[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 }); // Higher scale for better quality
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          await page.render({ canvasContext: context, viewport }).promise;
          newImages.push(canvas.toDataURL('image/png'));
        }
      }
      setImages(newImages);
    } catch (e) {
      console.error(e);
      alert('转换失败: ' + (e as Error).message);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {!file ? (
        <div className="tool-upload p-8 relative border-dashed border-2 border-slate-300 dark:border-slate-800 rounded-xl hover:border-primary-500 transition-colors bg-white dark:bg-slate-900 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-white p-4 shadow-sm mb-3">
            <ImageIcon className="w-8 h-8 text-primary-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">选择 PDF 文件转图片</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">本地渲染为高品质 PNG 并提供多维分段下载</p>
          </div>
          <input
            type="file"
            accept="application/pdf"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={handleFile}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="tool-section flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <FileText className="w-6 h-6 text-red-500" />
            <span className="flex-1 font-semibold text-slate-700 dark:text-slate-300">{file.name}</span>
            <Button variant="secondary" size="sm" onClick={() => setFile(null)}>更换文件</Button>
          </div>

          {images.length === 0 && (
            <Button onClick={convert} disabled={isConverting} className="w-full">
              {isConverting ? '正在转换页面...' : '开始转换为高清图片'}
            </Button>
          )}
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img, idx) => (
            <div key={idx} className="tool-section space-y-2 p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="aspect-[1/1.4] bg-slate-100 dark:bg-slate-950 rounded overflow-hidden relative">
                <img src={img} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-500">第 {idx + 1} 页</span>
                <a
                  href={img}
                  download={`page_${idx + 1}.png`}
                  className="text-primary-600 dark:text-primary-400 text-xs font-bold hover:underline"
                >
                  下载 PNG
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
