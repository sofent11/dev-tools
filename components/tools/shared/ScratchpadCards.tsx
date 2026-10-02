import React, { useMemo, useState } from 'react';
import { Copy, Check, Download, Trash2, FolderArchive } from 'lucide-react';
import { useI18n } from '../../../src/i18n';
import { translateUi as tr, useLocaleRender } from '../../../src/i18n/render';
import { getScratchpadItemContent, type ScratchpadItem } from './scratchpadStore';
import { sanitizeSvgMarkup } from './sanitizeMarkup';
import { notifyToast } from './notifyToast';
import { formatBytes } from './fileUtils';
export const normalizeScratchpadFileName = (name: string, fallbackExt: string) => {
  const fallbackName = `scratchpad-item${fallbackExt}`;
  const baseName = name
    .split(/[\\/]/)
    .pop()
    ?.replace(/[<>:"|?*]/g, '_')
    .trim();

  const withoutControlChars = baseName
    ? Array.from(baseName).map(char => (char.charCodeAt(0) < 32 ? '_' : char)).join('')
    : '';

  return withoutControlChars || fallbackName;
};

export const getScratchpadFallbackExt = (item: ScratchpadItem) => {
  if (item.type === 'svg' || item.name.endsWith('.svg')) return '';
  if (item.type === 'json' || item.name.endsWith('.json')) return '';
  if (item.type === 'jsx' || item.name.endsWith('.jsx')) return '';
  if (item.type === 'tsx' || item.name.endsWith('.tsx')) return '';
  return '.txt';
};

const getScratchpadMimeType = (item: ScratchpadItem) => {
  if (item.mime) return item.mime;
  if (item.type === 'svg' || item.name.endsWith('.svg')) return 'image/svg+xml;charset=utf-8';
  if (item.type === 'json' || item.name.endsWith('.json')) return 'application/json;charset=utf-8';
  return 'text/plain;charset=utf-8';
};

export const ScratchpadStorageHealth: React.FC<{
  status: 'ok' | 'degraded' | 'error';
  lastError?: string;
  quota: StorageEstimate | null;
  onRefresh: () => void;
}> = ({ status, lastError, quota, onRefresh }) => {
  useLocaleRender();
  const { t } = useI18n();
  const usage = quota?.usage ?? 0;
  const total = quota?.quota ?? 0;
  const percent = total > 0 ? Math.min(100, Math.round((usage / total) * 100)) : null;
  const tone = status === 'ok' ? 'emerald' : status === 'degraded' ? 'amber' : 'red';
  const label = status === 'ok' ? '存储健康' : status === 'degraded' ? '降级存储' : '存储异常';
  const description = status === 'ok'
    ? 'IndexedDB 可用，大文件会保存到浏览器本地。'
    : status === 'degraded'
      ? 'IndexedDB 不稳定，小文本仍会保存在元数据中。'
      : '大文件或二进制暂存可能失败，请下载本地文件或清理空间。';

  return (
    <div className={`mt-3 rounded-xl border p-3 text-xs ${
      tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-900'
          : 'border-red-200 bg-red-50 text-red-900'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-bold">{t(label)}</div>
          <p className="mt-1 leading-5">{t(description)}</p>
          {percent !== null && (
            <div className="mt-2">
              <div className="flex justify-between text-[10px] font-semibold opacity-80">
                <span>{formatBytes(usage)} / {formatBytes(total)}</span>
                <span>{percent}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/70">
                <div
                  className={`h-full ${tone === 'red' ? 'bg-red-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
          {lastError && <p className="mt-2 break-words text-[10px] opacity-80">{lastError}</p>}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-current/20 bg-white/70 px-2 py-1 text-[10px] font-bold hover:bg-white"
        >
          {t(tr('重新检测'))}
        </button>
      </div>
    </div>
  );
};

export const ScratchpadItemCard: React.FC<{
  item: ScratchpadItem;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<ScratchpadItem, 'name' | 'type' | 'mime' | 'sourceTool'>>) => void;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}> = ({ item, onRemove, onUpdate, isMultiSelectMode, isSelected, onToggleSelect }) => {
  useLocaleRender();
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState(item.name);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCopy = async () => {
    try {
      const content = await getScratchpadItemContent(item);
      let textToCopy = '';
      if (content instanceof Blob) {
        textToCopy = await content.text();
      } else if (content instanceof ArrayBuffer) {
        textToCopy = new TextDecoder().decode(content);
      } else {
        textToCopy = content;
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      notifyToast({ title: '复制失败', description: (err as Error).message, tone: 'error' });
    }
  };

  const handleDownload = async () => {
    try {
      const ext = getScratchpadFallbackExt(item);
      const fileName = normalizeScratchpadFileName(item.name.includes('.') ? item.name : `${item.name}${ext}`, ext);
      const content = await getScratchpadItemContent(item);
      const blob = content instanceof Blob ? content : new Blob([content], { type: getScratchpadMimeType(item) });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      notifyToast({ title: '下载失败', description: (err as Error).message, tone: 'error' });
    }
  };

  const isSvg = item.type === 'svg' || (item.content && item.content.trim().startsWith('<svg') && item.content.includes('</svg>'));
  const isJson = item.type === 'json' || (() => {
    if (!item.content) return false;
    try {
      const trimmed = item.content.trim();
      return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
    } catch {
      return false;
    }
  })();

  const jsonBadge = useMemo(() => {
    if (!isJson || !item.content) return '';
    try {
      const parsed = JSON.parse(item.content);
      if (Array.isArray(parsed)) return `Array (${parsed.length})`;
      if (typeof parsed === 'object' && parsed !== null) return `Object (${Object.keys(parsed).length} keys)`;
    } catch { /* ignore */ }
    return 'JSON';
  }, [item.content, isJson]);

  const sanitizedSvg = useMemo(
    () => (isSvg && item.content ? sanitizeSvgMarkup(item.content) : ''),
    [isSvg, item.content],
  );

  return (
    <div
      onClick={() => isMultiSelectMode && onToggleSelect()}
      className={`p-3 bg-slate-50 dark:bg-slate-950 border rounded-xl space-y-2 text-xs relative group transition-all hover:shadow-sm flex gap-2.5 ${
        isMultiSelectMode ? 'cursor-pointer' : ''
      } ${
        isSelected ? 'border-primary-400 bg-primary-500/5 dark:bg-primary-550/10' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {isMultiSelectMode && (
        <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 text-primary-600 rounded border-slate-350 focus:ring-primary-500 cursor-pointer"
          />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-2">
        {item.sensitive && <p className="text-amber-700">Session-only sensitive item · cleared on reload</p>}
        <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1 pr-2">
            {isEditingName ? (
              <input
                className="w-full rounded border border-primary-200 bg-white px-1 py-0.5 font-mono text-[11px] font-bold text-slate-800 outline-none focus:ring-2 focus:ring-primary-500/20 dark:bg-slate-900 dark:text-slate-100"
                value={draftName}
                autoFocus
                onClick={event => event.stopPropagation()}
                onChange={event => setDraftName(event.target.value)}
                onBlur={() => {
                  const nextName = draftName.trim() || item.name;
                  setDraftName(nextName);
                  onUpdate(item.id, { name: nextName });
                  setIsEditingName(false);
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setDraftName(item.name);
                    setIsEditingName(false);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                onClick={event => {
                  event.stopPropagation();
                  setIsEditingName(true);
                }}
                className="block max-w-full truncate text-left font-mono text-[11px] font-bold text-slate-800 hover:text-primary-700 dark:text-slate-200"
                title={tr(`${item.name} - 点击重命名`)}
              >
                {item.name}
              </button>
            )}
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[9px] text-slate-400 font-mono">
                {new Date(item.timestamp).toLocaleTimeString()} • {formatFileSize(item.size || item.content?.length || 0)}
              </span>
              {item.sourceTool && (
                <span className="border border-slate-200 bg-white px-1 py-0.2 text-[8px] font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  {item.sourceTool}
                </span>
              )}
              {isJson && (
                <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/35 px-1 py-0.2 rounded text-[8px] font-bold">
                  {jsonBadge}
                </span>
              )}
              {isSvg && (
                <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/35 px-1 py-0.2 rounded text-[8px] font-bold">
                  {t(tr('SVG 矢量图'))}
                </span>
              )}
              {item.isBinary && (
                <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/35 px-1 py-0.2 rounded text-[8px] font-bold uppercase">
                  {item.type}
                </span>
              )}
            </div>
          </div>
          {!isMultiSelectMode && (
            <div className="flex gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              <button
                onClick={handleCopy}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                title={t(tr('复制'))}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleDownload}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                title={t(tr('下载'))}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
                title={t(tr('删除'))}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Preview dynamic cards */}
        {item.thumbnail ? (
          <div className="h-16 w-full flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-850 bg-checkerboard p-1 overflow-hidden hover:scale-[1.01] transition-transform duration-200">
            <img src={item.thumbnail} alt={item.name} className="h-full w-auto max-w-full object-contain select-none rounded shadow-xs" />
          </div>
        ) : item.isBinary ? (
          <div className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-900/35">
              <FolderArchive className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-700 dark:text-slate-350 truncate text-[10px] font-mono leading-tight">{item.name}</p>
              <p className="text-[8px] text-slate-400 mt-0.5 font-bold uppercase">{item.mimeType || item.type || 'BINARY'}</p>
            </div>
          </div>
        ) : isSvg && sanitizedSvg ? (
          <div className="h-16 w-full flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-checkerboard p-1 overflow-hidden hover:scale-[1.02] transition-transform duration-200">
            <div className="h-full w-auto max-w-full flex items-center justify-center select-none" dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
          </div>
        ) : isJson && item.content ? (
          <div className="p-2 bg-slate-900 dark:bg-slate-950 border border-slate-850 rounded-lg font-mono text-[9px] text-emerald-400 max-h-16 overflow-y-auto leading-relaxed select-all whitespace-pre-wrap break-all scrollbar-none leading-normal">
            {(() => {
              try {
                return JSON.stringify(JSON.parse(item.content), null, 2).slice(0, 180) + (item.content.length > 180 ? '...' : '');
              } catch {
                return item.content.slice(0, 150) + '...';
              }
            })()}
          </div>
        ) : item.isLarge ? (
          <div className="p-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg font-mono text-[9px] text-slate-500 dark:text-slate-400 max-h-16 overflow-y-auto select-all whitespace-pre-wrap break-all scrollbar-none">
            <p className="text-slate-400 italic">[{t(tr('大容量文本内容已存入本地 IndexedDB'))}]</p>
            <p className="text-slate-500 font-bold mt-1">{t(tr('大小'))}: {formatFileSize(item.size)}</p>
          </div>
        ) : item.content ? (
          <div className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg font-mono text-[9px] text-slate-500 dark:text-slate-400 max-h-16 overflow-y-auto leading-relaxed select-all whitespace-pre-wrap break-all scrollbar-none">
            {item.content.slice(0, 180)}{item.content.length > 180 ? '...' : ''}
          </div>
        ) : (
          <div className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-lg font-mono text-[9px] text-slate-450 italic">
            {t(tr('无内容预览'))}
          </div>
        )}
      </div>
    </div>
  );
};
