import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Upload, FileText, Merge, Download, Trash2, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const PdfTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'merge' | 'toImage'>('merge');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="PDF Toolbox"
        description="Merge PDFs or convert PDF pages to images."
      />
      <div className="flex border-b border-slate-200 bg-white px-6">
        <button
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'merge' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('merge')}
        >
            Merge PDFs
        </button>
        <button
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'toImage' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('toImage')}
        >
            PDF to Image
        </button>
      </div>
      <CardContent className="flex-1 overflow-auto p-0">
        {activeTab === 'merge' ? <PdfMergeTool /> : <PdfToImageTool />}
      </CardContent>
    </Card>
  );
};

const PdfMergeTool: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isMerging, setIsMerging] = useState(false);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: -1 | 1) => {
    const newFiles = [...files];
    const targetIndex = index + direction;
    if (targetIndex >= 0 && targetIndex < newFiles.length) {
      [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
      setFiles(newFiles);
    }
  };

  const mergePdfs = async () => {
    if (files.length < 2) return;
    setIsMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `merged_${new Date().getTime()}.pdf`;
      link.click();
    } catch (e) {
      alert('Error merging PDFs: ' + (e as Error).message);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
       <div className="p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-4 text-center hover:bg-slate-100 transition-colors relative">
            <div className="p-4 bg-white rounded-full shadow-sm">
                <Merge className="w-8 h-8 text-primary-500" />
            </div>
            <div>
                <p className="font-medium text-slate-700">Add PDFs to merge</p>
                <p className="text-sm text-slate-500">Drag & drop or click to select</p>
            </div>
            <input
                type="file"
                accept="application/pdf"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFiles}
            />
        </div>

        {files.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-medium text-slate-800">Selected Files ({files.length})</h3>
            <div className="space-y-2">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <div className="w-8 h-8 bg-red-100 rounded flex items-center justify-center text-red-600">
                    <FileText className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-700 truncate">{file.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                        onClick={() => moveFile(i, -1)}
                        disabled={i === 0}
                        className="p-1 text-slate-400 hover:text-primary-600 disabled:opacity-30"
                    >
                        ↑
                    </button>
                    <button
                        onClick={() => moveFile(i, 1)}
                        disabled={i === files.length - 1}
                        className="p-1 text-slate-400 hover:text-primary-600 disabled:opacity-30"
                    >
                        ↓
                    </button>
                    <button
                        onClick={() => removeFile(i)}
                        className="p-1 text-slate-400 hover:text-red-600"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={mergePdfs} disabled={files.length < 2 || isMerging} className="w-full">
                {isMerging ? 'Merging...' : 'Merge PDFs'}
            </Button>
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
            alert('Conversion failed: ' + (e as Error).message);
        } finally {
            setIsConverting(false);
        }
    };

    return (
         <div className="p-6 space-y-6">
             {!file ? (
                <div className="p-8 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex flex-col items-center justify-center gap-4 text-center hover:bg-slate-100 transition-colors relative">
                    <div className="p-4 bg-white rounded-full shadow-sm">
                        <ImageIcon className="w-8 h-8 text-primary-500" />
                    </div>
                    <div>
                        <p className="font-medium text-slate-700">Select PDF to convert</p>
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
                     <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-lg">
                        <FileText className="w-6 h-6 text-red-500" />
                        <span className="flex-1 font-medium">{file.name}</span>
                        <Button variant="secondary" size="sm" onClick={() => setFile(null)}>Change</Button>
                     </div>

                     {images.length === 0 && (
                         <Button onClick={convert} disabled={isConverting} className="w-full">
                            {isConverting ? 'Converting Pages...' : 'Convert to Images'}
                         </Button>
                     )}
                 </div>
             )}

             {images.length > 0 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {images.map((img, idx) => (
                         <div key={idx} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm space-y-2">
                             <div className="aspect-[1/1.4] bg-slate-100 rounded overflow-hidden">
                                 <img src={img} alt={`Page ${idx + 1}`} className="w-full h-full object-contain" />
                             </div>
                             <div className="flex items-center justify-between px-1">
                                 <span className="text-xs font-medium text-slate-500">Page {idx + 1}</span>
                                 <a
                                    href={img}
                                    download={`page_${idx + 1}.png`}
                                    className="text-primary-600 text-xs font-medium hover:underline"
                                >
                                     Download
                                 </a>
                             </div>
                         </div>
                     ))}
                 </div>
             )}
         </div>
    );
};
