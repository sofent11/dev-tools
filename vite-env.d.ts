/// <reference types="vite/client" />

declare module 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.449/build/pdf.min.mjs' {
  interface PdfViewport {
    width: number;
    height: number;
  }

  interface PdfRenderTask {
    promise: Promise<void>;
  }

  interface PdfPageProxy {
    getViewport(options: { scale: number }): PdfViewport;
    render(options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): PdfRenderTask;
  }

  interface PdfDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PdfPageProxy>;
  }

  export const GlobalWorkerOptions: {
    workerSrc: string;
  };

  export function getDocument(...args: unknown[]): {
    promise: Promise<PdfDocumentProxy>;
  };
}
