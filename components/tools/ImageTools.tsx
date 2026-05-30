import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Download,
  FileImage,
  Grid3X3,
  Image as ImageIcon,
  RefreshCw,
  Scissors,
  Settings,
  Sparkles,
  Upload,
  Copy,
  Check,
} from 'lucide-react';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { TabButton, Tabs } from '../ui/ToolUi';

type SplitOutputFormat = 'image/png' | 'image/jpeg' | 'image/webp';

interface SplitOptions {
  backgroundTolerance: number;
  minGap: number;
  padding: number;
  outputFormat: SplitOutputFormat;
  quality: number;
}

interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ConnectedComponent extends BoundingBox {
  area: number;
}

interface ComponentGroup {
  primary: ConnectedComponent;
  members: ConnectedComponent[];
  bounds: BoundingBox;
  ownershipBounds: BoundingBox;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface SplitResult {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  size: number;
  bounds: BoundingBox;
  originalBounds: BoundingBox;
  format: SplitOutputFormat;
  quality: number;
}

interface SourceImageInfo {
  width: number;
  height: number;
}

type DragMode = 'move' | 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

interface DragState {
  resultId: string;
  mode: DragMode;
  startX: number;
  startY: number;
  initialBounds: BoundingBox;
}

const DEFAULT_SPLIT_OPTIONS: SplitOptions = {
  backgroundTolerance: 28,
  minGap: 22,
  padding: 16,
  outputFormat: 'image/png',
  quality: 0.92,
};

const MIN_BOUND_SIZE = 24;

// --- Helper: Format Bytes ---
const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const cloneBounds = (bounds: BoundingBox): BoundingBox => ({
  left: bounds.left,
  top: bounds.top,
  right: bounds.right,
  bottom: bounds.bottom,
});

const getBaseName = (fileName: string) => {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
};

const getExtensionForMimeType = (mimeType: SplitOutputFormat) => {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const loadImageFromFile = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to load the selected image.'));
    };
    img.src = url;
  });

const createSourceCanvasFromImage = (image: HTMLImageElement) => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Canvas is not available in the current browser.');
  }

  context.drawImage(image, 0, 0);
  return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: SplitOutputFormat, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to render image segment.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      mimeType === 'image/png' ? undefined : quality
    );
  });

const estimateBackgroundColor = (imageData: ImageData): RgbColor => {
  const { data, width, height } = imageData;
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  const sample = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    const alpha = data[index + 3];
    if (alpha < 16) {
      return;
    }
    red += data[index];
    green += data[index + 1];
    blue += data[index + 2];
    count += 1;
  };

  for (let x = 0; x < width; x += step) {
    sample(x, 0);
    sample(x, height - 1);
  }

  for (let y = 0; y < height; y += step) {
    sample(0, y);
    sample(width - 1, y);
  }

  if (!count) {
    return { r: 255, g: 255, b: 255 };
  }

  return {
    r: Math.round(red / count),
    g: Math.round(green / count),
    b: Math.round(blue / count),
  };
};

const buildForegroundMask = (imageData: ImageData, background: RgbColor, tolerance: number) => {
  const { data, width, height } = imageData;
  const mask = new Uint8Array(width * height);
  const toleranceSquared = tolerance * tolerance;

  for (let i = 0; i < width * height; i += 1) {
    const pixelIndex = i * 4;
    const alpha = data[pixelIndex + 3];
    if (alpha < 16) {
      continue;
    }

    const dr = data[pixelIndex] - background.r;
    const dg = data[pixelIndex + 1] - background.g;
    const db = data[pixelIndex + 2] - background.b;
    const distanceSquared = dr * dr + dg * dg + db * db;

    if (distanceSquared > toleranceSquared) {
      mask[i] = 1;
    }
  }

  return mask;
};

const expandBounds = (bounds: BoundingBox, width: number, height: number, padding: number): BoundingBox => ({
  left: clamp(bounds.left - padding, 0, width - 1),
  top: clamp(bounds.top - padding, 0, height - 1),
  right: clamp(bounds.right + padding, 0, width - 1),
  bottom: clamp(bounds.bottom + padding, 0, height - 1),
});

const getBoundWidth = (bounds: BoundingBox) => bounds.right - bounds.left + 1;
const getBoundHeight = (bounds: BoundingBox) => bounds.bottom - bounds.top + 1;
const getBoundCenterX = (bounds: BoundingBox) => (bounds.left + bounds.right) / 2;
const getBoundCenterY = (bounds: BoundingBox) => (bounds.top + bounds.bottom) / 2;

const isPointInBounds = (x: number, y: number, bounds: BoundingBox) =>
  x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;

const mergeBounds = (first: BoundingBox, second: BoundingBox): BoundingBox => ({
  left: Math.min(first.left, second.left),
  top: Math.min(first.top, second.top),
  right: Math.max(first.right, second.right),
  bottom: Math.max(first.bottom, second.bottom),
});

const clampBoundsToBounds = (bounds: BoundingBox, limits: BoundingBox): BoundingBox => ({
  left: clamp(bounds.left, limits.left, limits.right),
  top: clamp(bounds.top, limits.top, limits.bottom),
  right: clamp(bounds.right, limits.left, limits.right),
  bottom: clamp(bounds.bottom, limits.top, limits.bottom),
});

const applyMoveToBounds = (bounds: BoundingBox, deltaX: number, deltaY: number, sourceInfo: SourceImageInfo) => {
  const width = getBoundWidth(bounds);
  const height = getBoundHeight(bounds);
  const nextLeft = clamp(bounds.left + deltaX, 0, sourceInfo.width - width);
  const nextTop = clamp(bounds.top + deltaY, 0, sourceInfo.height - height);

  return {
    left: nextLeft,
    top: nextTop,
    right: nextLeft + width - 1,
    bottom: nextTop + height - 1,
  };
};

const applyResizeToBounds = (
  bounds: BoundingBox,
  mode: Exclude<DragMode, 'move'>,
  deltaX: number,
  deltaY: number,
  sourceInfo: SourceImageInfo
) => {
  const next = cloneBounds(bounds);

  if (mode.includes('left')) {
    next.left = clamp(bounds.left + deltaX, 0, bounds.right - MIN_BOUND_SIZE + 1);
  }
  if (mode.includes('right')) {
    next.right = clamp(bounds.right + deltaX, bounds.left + MIN_BOUND_SIZE - 1, sourceInfo.width - 1);
  }
  if (mode.includes('top')) {
    next.top = clamp(bounds.top + deltaY, 0, bounds.bottom - MIN_BOUND_SIZE + 1);
  }
  if (mode.includes('bottom')) {
    next.bottom = clamp(bounds.bottom + deltaY, bounds.top + MIN_BOUND_SIZE - 1, sourceInfo.height - 1);
  }

  return next;
};

const updateBoundsEdge = (
  bounds: BoundingBox,
  edge: 'left' | 'top' | 'right' | 'bottom',
  nextValue: number,
  sourceInfo: SourceImageInfo
) => {
  const value = Math.round(nextValue);

  if (edge === 'left') {
    return {
      ...bounds,
      left: clamp(value, 0, bounds.right - MIN_BOUND_SIZE + 1),
    };
  }

  if (edge === 'right') {
    return {
      ...bounds,
      right: clamp(value, bounds.left + MIN_BOUND_SIZE - 1, sourceInfo.width - 1),
    };
  }

  if (edge === 'top') {
    return {
      ...bounds,
      top: clamp(value, 0, bounds.bottom - MIN_BOUND_SIZE + 1),
    };
  }

  return {
    ...bounds,
    bottom: clamp(value, bounds.top + MIN_BOUND_SIZE - 1, sourceInfo.height - 1),
  };
};

const extractConnectedComponents = (mask: Uint8Array, width: number, height: number, minArea: number) => {
  const visited = new Uint8Array(mask.length);
  const components: ConnectedComponent[] = [];
  const queue: number[] = [];

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) {
      continue;
    }

    visited[index] = 1;
    queue.length = 0;
    queue.push(index);

    let queueIndex = 0;
    let area = 0;
    let left = index % width;
    let right = left;
    let top = Math.floor(index / width);
    let bottom = top;

    while (queueIndex < queue.length) {
      const current = queue[queueIndex];
      queueIndex += 1;

      const x = current % width;
      const y = Math.floor(current / width);
      area += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);

      if (x > 0) {
        const next = current - 1;
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      }

      if (x < width - 1) {
        const next = current + 1;
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      }

      if (y > 0) {
        const next = current - width;
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      }

      if (y < height - 1) {
        const next = current + width;
        if (mask[next] && !visited[next]) {
          visited[next] = 1;
          queue.push(next);
        }
      }
    }

    if (area >= minArea) {
      components.push({ left, top, right, bottom, area });
    }
  }

  return components;
};

const getBoundingRelationship = (source: BoundingBox, target: BoundingBox) => {
  const horizontalGap = Math.max(0, source.left - target.right, target.left - source.right);
  const verticalGap = Math.max(0, source.top - target.bottom, target.top - source.bottom);
  const overlapWidth = Math.max(0, Math.min(source.right, target.right) - Math.max(source.left, target.left));
  const overlapHeight = Math.max(0, Math.min(source.bottom, target.bottom) - Math.max(source.top, target.top));
  const centerDistance = Math.hypot(getBoundCenterX(source) - getBoundCenterX(target), getBoundCenterY(source) - getBoundCenterY(target));
  const score = horizontalGap * 1.2 + verticalGap * 1.6 + centerDistance * 0.08;

  return { horizontalGap, verticalGap, overlapWidth, overlapHeight, score };
};

const buildPrimaryOwnershipBounds = (
  primaryComponents: ConnectedComponent[],
  width: number,
  height: number,
  minGap: number
) => {
  const rows: Array<{ centerY: number; avgHeight: number; items: ConnectedComponent[] }> = [];
  const sortedComponents = [...primaryComponents].sort((a, b) => getBoundCenterY(a) - getBoundCenterY(b));

  sortedComponents.forEach((component) => {
    const centerY = getBoundCenterY(component);
    const componentHeight = getBoundHeight(component);
    const row = rows.find(
      (candidate) => Math.abs(centerY - candidate.centerY) <= Math.max(minGap * 3, candidate.avgHeight * 0.55)
    );

    if (!row) {
      rows.push({
        centerY,
        avgHeight: componentHeight,
        items: [component],
      });
      return;
    }

    row.items.push(component);
    row.centerY = (row.centerY * (row.items.length - 1) + centerY) / row.items.length;
    row.avgHeight = (row.avgHeight * (row.items.length - 1) + componentHeight) / row.items.length;
  });

  rows.sort((a, b) => a.centerY - b.centerY);

  const ownership = new Map<ConnectedComponent, BoundingBox>();
  rows.forEach((row, rowIndex) => {
    const rowTop =
      rowIndex === 0 ? 0 : Math.floor((rows[rowIndex - 1].centerY + row.centerY) / 2);
    const rowBottom =
      rowIndex === rows.length - 1 ? height - 1 : Math.ceil((row.centerY + rows[rowIndex + 1].centerY) / 2);
    const rowItems = [...row.items].sort((a, b) => getBoundCenterX(a) - getBoundCenterX(b));

    rowItems.forEach((component, componentIndex) => {
      const left =
        componentIndex === 0
          ? 0
          : Math.floor((getBoundCenterX(rowItems[componentIndex - 1]) + getBoundCenterX(component)) / 2);
      const right =
        componentIndex === rowItems.length - 1
          ? width - 1
          : Math.ceil((getBoundCenterX(component) + getBoundCenterX(rowItems[componentIndex + 1])) / 2);

      ownership.set(component, {
        left,
        top: rowTop,
        right,
        bottom: rowBottom,
      });
    });
  });

  return ownership;
};

const buildComponentGroups = (components: ConnectedComponent[], width: number, height: number, minGap: number) => {
  if (!components.length) {
    return [];
  }

  const largestArea = Math.max(...components.map((component) => component.area));
  let primaryThreshold = Math.max(400, largestArea * 0.18);
  let primaryComponents = components.filter((component) => component.area >= primaryThreshold);

  if (primaryComponents.length < 2) {
    primaryThreshold = Math.max(200, largestArea * 0.08);
    primaryComponents = components.filter((component) => component.area >= primaryThreshold);
  }

  const ownershipBounds = buildPrimaryOwnershipBounds(primaryComponents, width, height, minGap);
  const groups: ComponentGroup[] = primaryComponents.map((component) => {
    const primaryBounds = {
      left: component.left,
      top: component.top,
      right: component.right,
      bottom: component.bottom,
    };

    return {
      primary: component,
      members: [component],
      bounds: primaryBounds,
      ownershipBounds: ownershipBounds.get(component) || { left: 0, top: 0, right: width - 1, bottom: height - 1 },
    };
  });

  const accessoryComponents = components.filter((component) => component.area < primaryThreshold);
  const averagePrimaryWidth =
    primaryComponents.reduce((sum, component) => sum + getBoundWidth(component), 0) / primaryComponents.length;
  const averagePrimaryHeight =
    primaryComponents.reduce((sum, component) => sum + getBoundHeight(component), 0) / primaryComponents.length;
  const maxHorizontalAttachGap = Math.max(minGap * 2.5, averagePrimaryWidth * 0.45);
  const maxVerticalAttachGap = Math.max(minGap * 2.5, averagePrimaryHeight * 0.45);
  const maxAttachScore = maxHorizontalAttachGap + maxVerticalAttachGap;

  accessoryComponents.forEach((component) => {
    let bestGroup: ComponentGroup | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestHorizontalGap = Number.POSITIVE_INFINITY;
    let bestVerticalGap = Number.POSITIVE_INFINITY;
    const componentCenterX = getBoundCenterX(component);
    const componentCenterY = getBoundCenterY(component);

    groups.forEach((group) => {
      if (!isPointInBounds(componentCenterX, componentCenterY, group.ownershipBounds)) {
        return;
      }

      const relation = getBoundingRelationship(component, group.primary);
      if (relation.score < bestScore) {
        bestGroup = group;
        bestScore = relation.score;
        bestHorizontalGap = relation.horizontalGap;
        bestVerticalGap = relation.verticalGap;
      }
    });

    if (
      bestGroup &&
      bestHorizontalGap <= maxHorizontalAttachGap &&
      bestVerticalGap <= maxVerticalAttachGap &&
      bestScore <= maxAttachScore
    ) {
      bestGroup.members.push(component);
      bestGroup.bounds = clampBoundsToBounds(mergeBounds(bestGroup.bounds, component), bestGroup.ownershipBounds);
    }
  });

  return groups;
};

const sortGroupsByRows = (groups: ComponentGroup[], minGap: number) => {
  const rows: Array<{ avgTop: number; avgHeight: number; items: ComponentGroup[] }> = [];
  const sortedGroups = [...groups].sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);

  sortedGroups.forEach((group) => {
    const groupHeight = getBoundHeight(group.bounds);
    const row = rows.find(
      (candidate) =>
        Math.abs(group.bounds.top - candidate.avgTop) <=
        Math.max(minGap * 2, candidate.avgHeight * 0.45)
    );

    if (!row) {
      rows.push({
        avgTop: group.bounds.top,
        avgHeight: groupHeight,
        items: [group],
      });
      return;
    }

    row.items.push(group);
    row.avgTop = (row.avgTop * (row.items.length - 1) + group.bounds.top) / row.items.length;
    row.avgHeight = (row.avgHeight * (row.items.length - 1) + groupHeight) / row.items.length;
  });

  return rows.flatMap((row) => row.items.sort((a, b) => a.bounds.left - b.bounds.left));
};

const renderSplitResult = async (
  sourceCanvas: HTMLCanvasElement,
  payload: {
    id: string;
    name: string;
    bounds: BoundingBox;
    originalBounds: BoundingBox;
    format: SplitOutputFormat;
    quality: number;
  }
): Promise<SplitResult> => {
  const rawWidth = getBoundWidth(payload.bounds);
  const rawHeight = getBoundHeight(payload.bounds);
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = rawWidth;
  outputCanvas.height = rawHeight;
  const outputContext = outputCanvas.getContext('2d');

  if (!outputContext) {
    throw new Error('Unable to prepare output canvas.');
  }

  outputContext.drawImage(
    sourceCanvas,
    payload.bounds.left,
    payload.bounds.top,
    rawWidth,
    rawHeight,
    0,
    0,
    rawWidth,
    rawHeight
  );

  const blob = await canvasToBlob(outputCanvas, payload.format, payload.quality);
  return {
    id: payload.id,
    name: payload.name,
    blob,
    url: URL.createObjectURL(blob),
    width: rawWidth,
    height: rawHeight,
    size: blob.size,
    bounds: cloneBounds(payload.bounds),
    originalBounds: cloneBounds(payload.originalBounds),
    format: payload.format,
    quality: payload.quality,
  };
};

const createSplitResults = async (
  file: File,
  sourceCanvas: HTMLCanvasElement,
  options: SplitOptions
): Promise<{ results: SplitResult[]; background: RgbColor; sourceInfo: SourceImageInfo }> => {
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });

  if (!sourceContext) {
    throw new Error('Canvas is not available in the current browser.');
  }

  const imageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const background = estimateBackgroundColor(imageData);
  const mask = buildForegroundMask(imageData, background, options.backgroundTolerance);
  const minComponentArea = Math.max(80, Math.floor((sourceCanvas.width * sourceCanvas.height) / 20000));
  const components = extractConnectedComponents(mask, sourceCanvas.width, sourceCanvas.height, minComponentArea);

  if (!components.length) {
    throw new Error('No isolated stickers were detected. Try increasing the background tolerance.');
  }

  const groupedComponents = sortGroupsByRows(
    buildComponentGroups(components, sourceCanvas.width, sourceCanvas.height, options.minGap),
    options.minGap
  );

  if (!groupedComponents.length) {
    throw new Error('The sheet was detected, but the sticker groups could not be isolated.');
  }

  const splitResults: SplitResult[] = [];
  const baseName = getBaseName(file.name);
  const extension = getExtensionForMimeType(options.outputFormat);
  const minMeaningfulPixels = Math.max(50, Math.floor((sourceCanvas.width * sourceCanvas.height) / 60000));

  for (const group of groupedComponents) {
    const bounds = clampBoundsToBounds(
      expandBounds(group.bounds, sourceCanvas.width, sourceCanvas.height, options.padding),
      group.ownershipBounds
    );
    const rawWidth = getBoundWidth(bounds);
    const rawHeight = getBoundHeight(bounds);

    if (rawWidth * rawHeight < minMeaningfulPixels) {
      continue;
    }

    splitResults.push(
      await renderSplitResult(sourceCanvas, {
        id: `sticker-${splitResults.length + 1}`,
        name: `${baseName}_${String(splitResults.length + 1).padStart(2, '0')}.${extension}`,
        bounds,
        originalBounds: bounds,
        format: options.outputFormat,
        quality: options.quality,
      })
    );
  }

  if (!splitResults.length) {
    throw new Error('The sheet was detected, but no valid sticker region could be exported.');
  }

  return {
    results: splitResults,
    background,
    sourceInfo: {
      width: sourceCanvas.width,
      height: sourceCanvas.height,
    },
  };
};

const ImageCompressorPanel: React.FC = () => {
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
      alert('Compression failed: ' + (error as Error).message);
    } finally {
      setIsCompressing(false);
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
                  <Button onClick={downloadImage} icon={<Download className="w-4 h-4" />}>
                    Download
                  </Button>
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

const StickerSplitterPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [splitResults, setSplitResults] = useState<SplitResult[]>([]);
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<SplitOptions>(DEFAULT_SPLIT_OPTIONS);
  const [backgroundColor, setBackgroundColor] = useState<RgbColor | null>(null);
  const [sourceInfo, setSourceInfo] = useState<SourceImageInfo | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const splitResultsRef = useRef<SplitResult[]>([]);

  const selectedResult = splitResults.find((result) => result.id === selectedResultId) || null;

  useEffect(() => {
    splitResultsRef.current = splitResults;
  }, [splitResults]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    return () => {
      splitResultsRef.current.forEach((result) => URL.revokeObjectURL(result.url));
    };
  }, []);

  useEffect(() => {
    if (!dragState || !sourceInfo || !previewFrameRef.current) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!previewFrameRef.current) {
        return;
      }

      event.preventDefault();
      const rect = previewFrameRef.current.getBoundingClientRect();
      const deltaX = Math.round(((event.clientX - dragState.startX) / rect.width) * sourceInfo.width);
      const deltaY = Math.round(((event.clientY - dragState.startY) / rect.height) * sourceInfo.height);

      const nextBounds =
        dragState.mode === 'move'
          ? applyMoveToBounds(dragState.initialBounds, deltaX, deltaY, sourceInfo)
          : applyResizeToBounds(dragState.initialBounds, dragState.mode, deltaX, deltaY, sourceInfo);

      setSplitResults((current) => {
        const next = current.map((result) =>
          result.id === dragState.resultId
            ? {
                ...result,
                bounds: nextBounds,
                width: getBoundWidth(nextBounds),
                height: getBoundHeight(nextBounds),
              }
            : result
        );
        splitResultsRef.current = next;
        return next;
      });
    };

    const handlePointerUp = () => {
      const currentResult = splitResultsRef.current.find((result) => result.id === dragState.resultId);
      setDragState(null);

      if (!currentResult) {
        return;
      }

      void (async () => {
        if (!sourceCanvasRef.current) {
          return;
        }

        const updatedResult = await renderSplitResult(sourceCanvasRef.current, {
          id: currentResult.id,
          name: currentResult.name,
          bounds: currentResult.bounds,
          originalBounds: currentResult.originalBounds,
          format: currentResult.format,
          quality: currentResult.quality,
        });

        setSplitResults((current) => {
          const previous = current.find((result) => result.id === updatedResult.id);
          if (previous && previous.url !== updatedResult.url) {
            URL.revokeObjectURL(previous.url);
          }

          const next = current.map((result) => (result.id === updatedResult.id ? updatedResult : result));
          splitResultsRef.current = next;
          return next;
        });
      })();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, sourceInfo]);

  const replaceAllResults = (nextResults: SplitResult[]) => {
    splitResultsRef.current.forEach((result) => URL.revokeObjectURL(result.url));
    splitResultsRef.current = nextResults;
    setSplitResults(nextResults);
    setSelectedResultId(nextResults[0]?.id ?? null);
  };

  const resetSplitResults = () => {
    splitResultsRef.current.forEach((result) => URL.revokeObjectURL(result.url));
    splitResultsRef.current = [];
    setSplitResults([]);
    setSelectedResultId(null);
    setBackgroundColor(null);
    setSourceInfo(null);
    setDragState(null);
    sourceCanvasRef.current = null;
    setError(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) {
      return;
    }

    resetSplitResults();
    setFile(event.target.files[0]);
  };

  const commitBoundsUpdate = async (resultId: string, nextBounds: BoundingBox) => {
    const sourceCanvas = sourceCanvasRef.current;
    const currentResult = splitResultsRef.current.find((result) => result.id === resultId);

    if (!sourceCanvas || !currentResult) {
      return;
    }

    const updatedResult = await renderSplitResult(sourceCanvas, {
      id: currentResult.id,
      name: currentResult.name,
      bounds: nextBounds,
      originalBounds: currentResult.originalBounds,
      format: currentResult.format,
      quality: currentResult.quality,
    });

    setSplitResults((current) => {
      const previous = current.find((result) => result.id === updatedResult.id);
      if (previous && previous.url !== updatedResult.url) {
        URL.revokeObjectURL(previous.url);
      }

      const next = current.map((result) => (result.id === updatedResult.id ? updatedResult : result));
      splitResultsRef.current = next;
      return next;
    });
  };

  const previewBoundsUpdate = (resultId: string, nextBounds: BoundingBox) => {
    setSplitResults((current) => {
      const next = current.map((result) =>
        result.id === resultId
          ? {
              ...result,
              bounds: nextBounds,
              width: getBoundWidth(nextBounds),
              height: getBoundHeight(nextBounds),
            }
          : result
      );
      splitResultsRef.current = next;
      return next;
    });
  };

  const handleSplit = async () => {
    if (!file) {
      return;
    }

    setIsSplitting(true);
    setError(null);

    try {
      const image = await loadImageFromFile(file);
      const sourceCanvas = createSourceCanvasFromImage(image);
      sourceCanvasRef.current = sourceCanvas;
      const { results, background, sourceInfo: nextSourceInfo } = await createSplitResults(file, sourceCanvas, options);
      replaceAllResults(results);
      setBackgroundColor(background);
      setSourceInfo(nextSourceInfo);
    } catch (nextError) {
      console.error(nextError);
      replaceAllResults([]);
      setBackgroundColor(null);
      setSourceInfo(null);
      setError((nextError as Error).message);
    } finally {
      setIsSplitting(false);
    }
  };

  const downloadSingle = (result: SplitResult) => {
    downloadBlob(result.blob, result.name);
  };

  const downloadZip = async () => {
    if (!splitResults.length || !file) {
      return;
    }

    const zip = new JSZip();
    splitResults.forEach((result) => {
      zip.file(result.name, result.blob);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `${getBaseName(file.name)}_split.zip`);
  };

  const startDraggingBox = (result: SplitResult, event: React.PointerEvent, mode: DragMode) => {
    if (!sourceInfo) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setSelectedResultId(result.id);
    setDragState({
      resultId: result.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      initialBounds: cloneBounds(result.bounds),
    });
  };

  const handleSelectedEdgeChange = async (
    edge: 'left' | 'top' | 'right' | 'bottom',
    value: string
  ) => {
    if (!selectedResult || !sourceInfo) {
      return;
    }

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      return;
    }

    const nextBounds = updateBoundsEdge(selectedResult.bounds, edge, parsed, sourceInfo);
    previewBoundsUpdate(selectedResult.id, nextBounds);
    await commitBoundsUpdate(selectedResult.id, nextBounds);
  };

  const adjustSelectedBounds = async (delta: number) => {
    if (!selectedResult || !sourceInfo) {
      return;
    }

    const nextBounds: BoundingBox = {
      left: selectedResult.bounds.left - delta,
      top: selectedResult.bounds.top - delta,
      right: selectedResult.bounds.right + delta,
      bottom: selectedResult.bounds.bottom + delta,
    };

    nextBounds.left = clamp(nextBounds.left, 0, sourceInfo.width - MIN_BOUND_SIZE);
    nextBounds.top = clamp(nextBounds.top, 0, sourceInfo.height - MIN_BOUND_SIZE);
    nextBounds.right = clamp(nextBounds.right, nextBounds.left + MIN_BOUND_SIZE - 1, sourceInfo.width - 1);
    nextBounds.bottom = clamp(nextBounds.bottom, nextBounds.top + MIN_BOUND_SIZE - 1, sourceInfo.height - 1);

    previewBoundsUpdate(selectedResult.id, nextBounds);
    await commitBoundsUpdate(selectedResult.id, nextBounds);
  };

  const resetSelectedBounds = async () => {
    if (!selectedResult) {
      return;
    }

    const nextBounds = cloneBounds(selectedResult.originalBounds);
    previewBoundsUpdate(selectedResult.id, nextBounds);
    await commitBoundsUpdate(selectedResult.id, nextBounds);
  };

  const resizeHandles: Array<{
    mode: Exclude<DragMode, 'move'>;
    className: string;
    cursor: string;
  }> = [
    { mode: 'top-left', className: '-left-2 -top-2', cursor: 'nwse-resize' },
    { mode: 'top-right', className: '-right-2 -top-2', cursor: 'nesw-resize' },
    { mode: 'bottom-left', className: '-left-2 -bottom-2', cursor: 'nesw-resize' },
    { mode: 'bottom-right', className: '-right-2 -bottom-2', cursor: 'nwse-resize' },
    { mode: 'top', className: 'left-1/2 -top-2 -translate-x-1/2', cursor: 'ns-resize' },
    { mode: 'bottom', className: 'left-1/2 -bottom-2 -translate-x-1/2', cursor: 'ns-resize' },
    { mode: 'left', className: '-left-2 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
    { mode: 'right', className: '-right-2 top-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  ];

  return (
    <CardContent className="flex-1 flex flex-col gap-6 overflow-auto">
      <div className="tool-upload flex-none p-6">
        <div className="rounded-full bg-white p-4 shadow-sm">
          <Scissors className="w-8 h-8 text-primary-500" />
        </div>
        <div>
          <p className="font-medium text-slate-700">上传整张表情包图片</p>
          <p className="text-sm text-slate-500">适合纯色背景、单个表情之间有明显留白的贴纸图</p>
        </div>
        <input
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <div className="flex flex-col xl:flex-row gap-6 min-h-0">
          <div className="tool-section h-fit w-full flex-none space-y-5 p-4 xl:w-[22rem]">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Settings className="w-4 h-4" /> 拆分参数
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">背景容差</label>
                <input
                  type="range"
                  min="8"
                  max="80"
                  value={options.backgroundTolerance}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      backgroundTolerance: Number.parseInt(e.target.value, 10),
                    })
                  }
                  className="w-full"
                />
                <p className="text-xs text-slate-500 mt-1">
                  当前 {options.backgroundTolerance}，背景不是纯白时可适当调高
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">最小留白</label>
                <input
                  type="number"
                  min="8"
                  max="80"
                  value={options.minGap}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      minGap: clamp(Number.parseInt(e.target.value, 10) || DEFAULT_SPLIT_OPTIONS.minGap, 8, 80),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">用于连接同一表情附近的小装饰，避免被误拆成多行多列</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">裁切留边 (px)</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={options.padding}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      padding: clamp(Number.parseInt(e.target.value, 10) || 0, 0, 80),
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">导出格式</label>
                <select
                  value={options.outputFormat}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      outputFormat: e.target.value as SplitOutputFormat,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="image/png">PNG</option>
                  <option value="image/jpeg">JPEG</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>

              {options.outputFormat !== 'image/png' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">导出质量</label>
                  <input
                    type="range"
                    min="0.5"
                    max="1"
                    step="0.01"
                    value={options.quality}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        quality: Number.parseFloat(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-slate-500 mt-1">当前 {Math.round(options.quality * 100)}%</p>
                </div>
              )}
            </div>

            <Button
              onClick={handleSplit}
              disabled={isSplitting}
              className="w-full"
              icon={isSplitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
            >
              {isSplitting ? '正在拆分...' : '自动拆分表情包'}
            </Button>

            <div className="tool-panel space-y-2 p-3 text-sm text-slate-600">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Sparkles className="w-4 h-4 text-amber-500" />
                使用建议
              </div>
              <p>背景越纯、表情之间的空白越明显，切出来会越准。</p>
              <p>如果装饰小图标被拆散了，优先把“最小留白”调大一点再重试。</p>
              <p>拆分后可直接拖动边框或拖四边控制点，手工修正每张的裁切范围。</p>
            </div>

            {selectedResult && sourceInfo && (
              <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-primary-900">手工调整当前边框</p>
                  <p className="text-xs text-primary-700 mt-1">
                    已选中 {selectedResult.name}，可拖动预览框，或在这里精确调整四边坐标。
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Left</label>
                    <input
                      type="number"
                      min="0"
                      max={sourceInfo.width - 1}
                      value={selectedResult.bounds.left}
                      onChange={(e) => {
                        void handleSelectedEdgeChange('left', e.target.value);
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Top</label>
                    <input
                      type="number"
                      min="0"
                      max={sourceInfo.height - 1}
                      value={selectedResult.bounds.top}
                      onChange={(e) => {
                        void handleSelectedEdgeChange('top', e.target.value);
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Right</label>
                    <input
                      type="number"
                      min="0"
                      max={sourceInfo.width - 1}
                      value={selectedResult.bounds.right}
                      onChange={(e) => {
                        void handleSelectedEdgeChange('right', e.target.value);
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Bottom</label>
                    <input
                      type="number"
                      min="0"
                      max={sourceInfo.height - 1}
                      value={selectedResult.bounds.bottom}
                      onChange={(e) => {
                        void handleSelectedEdgeChange('bottom', e.target.value);
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void adjustSelectedBounds(4);
                    }}
                  >
                    四边外扩 4px
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      void adjustSelectedBounds(-4);
                    }}
                  >
                    四边收紧 4px
                  </Button>
                </div>

                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => {
                    void resetSelectedBounds();
                  }}
                >
                  恢复自动识别边框
                </Button>

                <p className="text-xs text-slate-500">
                  当前尺寸 {selectedResult.width} × {selectedResult.height} px
                </p>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-4">
            <div className="tool-panel flex items-center gap-4 p-4">
              <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-slate-400">
                <ImageIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 truncate">{file.name}</p>
                <p className="text-sm text-slate-500">
                  {formatBytes(file.size)} • {file.type || 'image'}
                </p>
              </div>
              {splitResults.length > 0 && (
                <Button onClick={downloadZip} icon={<Archive className="w-4 h-4" />}>
                  下载 ZIP
                </Button>
              )}
            </div>

            {error && (
              <div className="status-error px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {previewUrl && (
              <div className="tool-section overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <div>
                    <p className="font-medium text-slate-800">原图预览</p>
                    <p className="text-sm text-slate-500">
                      {splitResults.length > 0
                        ? `已识别 ${splitResults.length} 个表情`
                        : '拆分后会在原图上标出裁切范围'}
                    </p>
                  </div>
                  {backgroundColor && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>背景色</span>
                      <span
                        className="w-4 h-4 rounded border border-slate-200"
                        style={{
                          backgroundColor: `rgb(${backgroundColor.r}, ${backgroundColor.g}, ${backgroundColor.b})`,
                        }}
                      />
                      <span>
                        rgb({backgroundColor.r}, {backgroundColor.g}, {backgroundColor.b})
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div ref={previewFrameRef} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                    <img src={previewUrl} alt="Sticker sheet preview" className="block w-full h-auto" />
                    {splitResults.length > 0 && sourceInfo && (
                      <div className="absolute inset-0">
                        {splitResults.map((result, index) => (
                          <div
                            key={result.id}
                            className={`absolute border-2 transition-colors ${
                              selectedResultId === result.id
                                ? 'border-primary-600 bg-primary-400/15 shadow-[0_0_0_1px_rgba(37,99,235,0.15)]'
                                : 'border-primary-500/70 bg-primary-300/10 hover:border-primary-500'
                            }`}
                            style={{
                              left: `${(result.bounds.left / sourceInfo.width) * 100}%`,
                              top: `${(result.bounds.top / sourceInfo.height) * 100}%`,
                              width: `${((result.bounds.right - result.bounds.left + 1) / sourceInfo.width) * 100}%`,
                              height: `${((result.bounds.bottom - result.bounds.top + 1) / sourceInfo.height) * 100}%`,
                              cursor: dragState?.resultId === result.id ? 'grabbing' : 'move',
                              zIndex: selectedResultId === result.id ? 20 : 10,
                            }}
                            onPointerDown={(event) => startDraggingBox(result, event, 'move')}
                          >
                            <span className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-primary-600 text-white text-[11px] font-medium pointer-events-none">
                              {index + 1}
                            </span>
                            {selectedResultId === result.id &&
                              resizeHandles.map((handle) => (
                                <button
                                  key={handle.mode}
                                  type="button"
                                  className={`absolute h-4 w-4 rounded-full border border-white bg-primary-600 shadow ${handle.className}`}
                                  style={{ cursor: handle.cursor, zIndex: 30 }}
                                  onPointerDown={(event) => startDraggingBox(result, event, handle.mode)}
                                />
                              ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {splitResults.length > 0 && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="tool-section p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Grid3X3 className="w-4 h-4" />
                      已切出数量
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{splitResults.length}</p>
                  </div>
                  <div className="tool-section p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <FileImage className="w-4 h-4" />
                      单张默认格式
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {getExtensionForMimeType(options.outputFormat).toUpperCase()}
                    </p>
                  </div>
                  <div className="tool-section p-4">
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Archive className="w-4 h-4" />
                      打包下载
                    </div>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">ZIP</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {splitResults.map((result, index) => (
                    <div
                      key={result.id}
                      className={`space-y-3 rounded-lg border bg-white p-3 shadow-sm transition-colors ${
                        selectedResultId === result.id
                          ? 'border-primary-300 ring-2 ring-primary-100'
                          : 'border-slate-200 hover:border-primary-200'
                      }`}
                      onClick={() => setSelectedResultId(result.id)}
                    >
                      <div className="aspect-square bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src={result.url} alt={result.name} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          #{index + 1} {result.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {result.width} × {result.height} • {formatBytes(result.size)}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() => downloadSingle(result)}
                        icon={<Download className="w-4 h-4" />}
                      >
                        下载单张
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </CardContent>
  );
};

// --- Image Vectorizer Panel (Grayscale Marching Edges) ---
const ImageVectorizerPanel: React.FC = () => {
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

  const getSvgContent = () => {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="background-color: ${bgColor};">\n  <path d="${svgPath}" fill="${fillColor}" fill-rule="evenodd" />\n</svg>`;
  };

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(getSvgContent());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadSvg = () => {
    const svgContent = getSvgContent();
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const name = file ? getBaseName(file.name) : 'vectorized';
    downloadBlob(blob, `${name}.svg`);
  };

  const sendSvgToScratchpad = () => {
    if (!svgPath) return;
    try {
      const scratchEvent = new CustomEvent('add-scratchpad-item', {
        detail: {
          name: `${file ? getBaseName(file.name) : 'vectorized'}.svg`,
          content: getSvgContent(),
          type: 'text'
        }
      });
      window.dispatchEvent(scratchEvent);
      alert('已成功将生成的无损 SVG 送入全局暂存箱！');
    } catch {
      alert('送入暂存箱失败');
    }
  };

  const handleVectorize = () => {
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
  };

  useEffect(() => {
    if (previewUrl) {
      Promise.resolve().then(handleVectorize);
    }
  }, [threshold, simplifyTolerance, invert, previewUrl]);

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
              {getSvgContent()}
            </pre>
          ) : svgPath ? (
            <div 
              className="max-w-full max-h-full aspect-square border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow flex items-center justify-center"
              style={{
                width: `${svgWidth}px`,
                height: `${svgHeight}px`,
                backgroundColor: bgColor
              }}
              dangerouslySetInnerHTML={{ __html: getSvgContent() }}
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

// Precise mathematical marching edge boundary crawler
const runMarchingEdges = (canvas: HTMLCanvasElement, threshold: number, invert: boolean, simplifyTol: number): string => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const binary = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const a = data[i+3];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const isFg = a > 50 && gray < threshold;
    binary[i/4] = invert ? (isFg ? 0 : 1) : (isFg ? 1 : 0);
  }

  const getVal = (col: number, row: number) => {
    if (col < 0 || col >= w || row < 0 || row >= h) return 0;
    return binary[row * w + col];
  };

  const adj = new Map<string, string>();
  for (let r = 0; r <= h; r++) {
    for (let c = 0; c <= w; c++) {
      const val = getVal(c, r);
      const valLeft = getVal(c - 1, r);
      const valUp = getVal(c, r - 1);

      if (val !== valUp) {
        const start = val ? `${c+1},${r}` : `${c},${r}`;
        const end = val ? `${c},${r}` : `${c+1},${r}`;
        adj.set(start, end);
      }

      if (val !== valLeft) {
        const start = val ? `${c},${r}` : `${c},${r+1}`;
        const end = val ? `${c},${r+1}` : `${c},${r}`;
        adj.set(start, end);
      }
    }
  }

  const visited = new Set<string>();
  const loops: [number, number][][] = [];

  for (const startKey of adj.keys()) {
    if (visited.has(startKey)) continue;

    const loop: [number, number][] = [];
    let curr = startKey;
    while (curr && !visited.has(curr)) {
      visited.add(curr);
      const [x, y] = curr.split(',').map(Number);
      loop.push([x, y]);
      curr = adj.get(curr) || '';
      if (curr === startKey) {
        break;
      }
    }
    if (loop.length > 2) {
      loops.push(loop);
    }
  }

  let pathD = '';
  loops.forEach(loop => {
    let pts = loop;
    if (simplifyTol > 0) {
      pts = simplifyCollinearPath(loop, simplifyTol);
    }
    if (pts.length < 3) return;
    pathD += `M ${pts[0][0]} ${pts[0][1]} `;
    for (let i = 1; i < pts.length; i++) {
      pathD += `L ${pts[i][0]} ${pts[i][1]} `;
    }
    pathD += 'Z ';
  });

  return pathD.trim();
};

const simplifyCollinearPath = (points: [number, number][], tol: number): [number, number][] => {
  if (points.length < 3) return points;
  const result: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = result[result.length - 1];
    const curr = points[i];
    const next = points[i + 1];

    const dx1 = curr[0] - prev[0];
    const dy1 = curr[1] - prev[1];
    const dx2 = next[0] - curr[0];
    const dy2 = next[1] - curr[1];

    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) > tol * 0.25) {
      result.push(curr);
    }
  }
  result.push(points[points.length - 1]);
  return result;
};

export const ImageTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'compress' | 'split' | 'vectorizer'>('compress');

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title="Image Toolbox"
        description="Compress images, convert formats, split sticker sheets, or vectorize bitmap images to SVGs offline."
      />
      <Tabs>
        <TabButton active={activeTab === 'compress'} onClick={() => setActiveTab('compress')}>
          图片压缩/转换
        </TabButton>
        <TabButton active={activeTab === 'split'} onClick={() => setActiveTab('split')}>
          表情包拆分
        </TabButton>
        <TabButton active={activeTab === 'vectorizer'} onClick={() => setActiveTab('vectorizer')}>
          图片矢量化 (Vectorizer)
        </TabButton>
      </Tabs>

      {activeTab === 'compress' ? (
        <ImageCompressorPanel />
      ) : activeTab === 'split' ? (
        <StickerSplitterPanel />
      ) : (
        <ImageVectorizerPanel />
      )}
    </Card>
  );
};
