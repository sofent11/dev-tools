import React, { Suspense, useEffect, useState, useMemo } from 'react';
import {
  LayoutGrid, Search, Menu, X, ChevronDown, ChevronRight, Sun, Moon, ClipboardList, Trash2, Download, Copy, Check, FolderArchive, Languages
} from 'lucide-react';
import JSZip from 'jszip';
import { useScratchpadStore, getScratchpadItemContent, type ScratchpadItem } from './components/tools/shared/scratchpadStore';
import { sanitizeSvgMarkup } from './components/tools/shared/sanitizeMarkup';
import { Category, ToolDef } from './types';
import { TOOLS, TOOL_IDS, LEGACY_TOOL_MAP } from './components/tools/registry';
import { useI18n } from './src/i18n';
import { formatBytes } from './components/tools/shared/fileUtils';
import { notifyToast, type ToastTone } from './components/tools/shared/notifyToast';

const DEFAULT_TOOL_ID = TOOLS[0].id;
const TOOL_ROUTE_PREFIX = 'tools';

const getBasePath = () => {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/') return '';

  const withoutTrailingSlash = base.endsWith('/') ? base.slice(0, -1) : base;
  return withoutTrailingSlash.startsWith('/') ? withoutTrailingSlash : `/${withoutTrailingSlash}`;
};

const getAppPathname = () => {
  const basePath = getBasePath();
  const pathname = window.location.pathname;

  if (basePath && pathname.startsWith(basePath)) {
    return pathname.slice(basePath.length) || '/';
  }

  return pathname || '/';
};

const getToolIdFromLocation = () => {
  const segments = getAppPathname().split('/').filter(Boolean).map(decodeURIComponent);
  const candidate = segments[0] === TOOL_ROUTE_PREFIX ? segments[1] : segments[0];

  if (candidate && LEGACY_TOOL_MAP[candidate]) {
    const mapping = LEGACY_TOOL_MAP[candidate];
    const targetPath = `${getBasePath()}/${TOOL_ROUTE_PREFIX}/${mapping.studioId}`;
    window.history.replaceState(null, '', `${targetPath}#${mapping.subToolId}`);
    return mapping.studioId;
  }

  return candidate && TOOL_IDS.has(candidate) ? candidate : DEFAULT_TOOL_ID;
};

const getToolPath = (toolId: string) => `${getBasePath()}/${TOOL_ROUTE_PREFIX}/${encodeURIComponent(toolId)}`;

const normalizeScratchpadFileName = (name: string, fallbackExt: string) => {
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

const getScratchpadFallbackExt = (item: ScratchpadItem) => {
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

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
}

const translateTextForSearch = (
  value: string,
  query: string,
  translate: (value: string) => string,
) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return translate(value).toLowerCase().includes(normalizedQuery);
};

export default function App() {
  const { locale, toggleLocale, t } = useI18n();
  const [activeToolId, setActiveToolId] = useState<string>(() => getToolIdFromLocation());
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  // Zustand Global Scratchpad Store State
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const scratchpadItems = useScratchpadStore((state) => state.items);
  const scratchpadStorageStatus = useScratchpadStore((state) => state.storageStatus);
  const scratchpadStorageError = useScratchpadStore((state) => state.lastStorageError);
  const estimateScratchpadQuota = useScratchpadStore((state) => state.estimateQuota);
  const removeScratchpadItem = useScratchpadStore((state) => state.removeItem);
  const updateScratchpadItem = useScratchpadStore((state) => state.updateItem);
  const clearScratchpad = useScratchpadStore((state) => state.clearAll);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [scratchpadQuota, setScratchpadQuota] = useState<StorageEstimate | null>(null);
  const validSelectedIds = useMemo(() => {
    const availableIds = new Set(scratchpadItems.map(item => item.id));
    return selectedIds.filter(id => availableIds.has(id));
  }, [scratchpadItems, selectedIds]);

  const handleExportZip = async (itemsToExport: typeof scratchpadItems) => {
    if (itemsToExport.length === 0) return;
    try {
      const zip = new JSZip();
      for (const item of itemsToExport) {
        const ext = getScratchpadFallbackExt(item);
        const fileName = normalizeScratchpadFileName(item.name.includes('.') ? item.name : `${item.name}${ext}`, ext);
        const fileContent = await getScratchpadItemContent(item);
        zip.file(fileName, fileContent);
      }
      const blobContent = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blobContent);
      link.download = `scratchpad_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (err) {
      notifyToast({
        title: '打包 ZIP 失败',
        description: (err as Error).message,
        tone: 'error',
      });
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!isScratchpadOpen) return;

    estimateScratchpadQuota().then(setScratchpadQuota);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsScratchpadOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [estimateScratchpadQuota, isScratchpadOpen]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastMessage, 'id'>>).detail;
      const toast: ToastMessage = {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        tone: detail?.tone || 'info',
        title: detail?.title || '',
        description: detail?.description,
        actionLabel: detail?.actionLabel,
        onAction: detail?.onAction,
      };
      if (!toast.title) return;
      setToasts(previous => [toast, ...previous].slice(0, 4));
      window.setTimeout(() => {
        setToasts(previous => previous.filter(item => item.id !== toast.id));
      }, toast.tone === 'error' ? 5000 : 3000);
    };

    window.addEventListener('devtoolbox-toast', handleToast);
    return () => window.removeEventListener('devtoolbox-toast', handleToast);
  }, []);

  // Fallback to first tool if active one not found
  const activeTool = TOOLS.find(t => t.id === activeToolId) || TOOLS[0];
  const ActiveToolComponent = activeTool.component;

  useEffect(() => {
    const syncToolFromLocation = () => {
      setActiveToolId(getToolIdFromLocation());
    };

    window.addEventListener('popstate', syncToolFromLocation);
    return () => window.removeEventListener('popstate', syncToolFromLocation);
  }, []);

  useEffect(() => {
    document.title = `${t(activeTool.name)} - ${t('程序员百宝箱')}`;
  }, [activeTool.name, t]);

  const activateTool = (toolId: string) => {
    setActiveToolId(toolId);

    const nextPath = getToolPath(toolId);
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }

    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  // Group tools by category
  const filteredTools = TOOLS.filter(tool =>
    tool.name.toLowerCase().includes(search.toLowerCase()) ||
    tool.description.toLowerCase().includes(search.toLowerCase()) ||
    translateTextForSearch(tool.name, search, t) ||
    translateTextForSearch(tool.description, search, t)
  );

  // Ensure order of categories based on Enum definition or custom order
  const categoryOrder = Object.values(Category);

  const groupedTools = categoryOrder.reduce((acc, cat) => {
    const tools = filteredTools.filter(t => t.category === cat);
    if (tools.length > 0) acc[cat] = tools;
    return acc;
  }, {} as Record<string, ToolDef[]>);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--surface-canvas)] font-sans text-slate-950">

      {/* Mobile Menu Overlay */}
      {!isSidebarOpen && (
        <button
          className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden"
          onClick={() => setIsSidebarOpen(true)}
          aria-label={t('打开工具目录')}
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      )}

      {isSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label={t('关闭工具目录遮罩')}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 flex w-80 transform flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-16 flex-none items-center gap-3 border-b border-slate-100 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-normal text-slate-950">程序员百宝箱</div>
            <div className="text-xs font-medium text-slate-500">{TOOLS.length} {t('个开发效率工具')}</div>
          </div>
          <button
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label={t('关闭工具目录')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-none border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('搜索工具...')}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/15"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="app-scrollbar flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {Object.entries(groupedTools).map(([category, tools]) => (
            <div key={category}>
              <h3 className="sticky top-0 z-10 bg-white/95 py-1 backdrop-blur">
                <button
                  type="button"
                  aria-expanded={!collapsedCategories[category]}
                  aria-controls={`tool-group-${category}`}
                  onClick={() => toggleCategory(category)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold uppercase tracking-normal text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                >
                  {collapsedCategories[category] ? (
                    <ChevronRight className="w-3.5 h-3.5 flex-none" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 flex-none" />
                  )}
                  <span className="flex-1 text-left truncate">{t(category)}</span>
                  <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-[10px] leading-none text-slate-500">
                    {tools.length}
                  </span>
                </button>
              </h3>
              {!collapsedCategories[category] && (
                <div id={`tool-group-${category}`} className="mt-1 space-y-1">
                  {tools.map(tool => (
                    <a
                      key={tool.id}
                      href={getToolPath(tool.id)}
                      onClick={(event) => {
                        event.preventDefault();
                        activateTool(tool.id);
                      }}
                      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                        ${activeToolId === tool.id
                          ? 'bg-primary-50 text-primary-800 ring-1 ring-primary-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}
                      `}
                      title={`${t(tool.name)} - ${t(tool.description)}`}
                    >
                      <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg border
                        ${activeToolId === tool.id ? 'border-primary-100 bg-white text-primary-700' : 'border-slate-100 bg-white text-slate-400 group-hover:text-slate-700'}
                      `}>
                        <tool.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-medium">{t(tool.name)}</span>
                        <span className="block truncate text-xs text-slate-400 group-hover:text-slate-500">{t(tool.description)}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          {Object.keys(groupedTools).length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
              {t('未找到相关工具')}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-auto min-h-16 flex-none flex-col gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label={t('打开工具目录')}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-700">
              <activeTool.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-normal text-slate-950">{t(activeTool.name)}</h1>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {t(activeTool.category)}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-500">{t(activeTool.description)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 ml-auto md:ml-0">
            <button
              onClick={() => setIsScratchpadOpen(true)}
              className="relative p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
              title={t('打开全局数据暂存箱')}
              aria-label={t('打开全局数据暂存箱')}
            >
              <ClipboardList className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              {scratchpadItems.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white leading-none">
                  {scratchpadItems.length}
                </span>
              )}
            </button>
            <button
              onClick={toggleLocale}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
              title={locale === 'zh-CN' ? 'Switch to English' : 'Switch to Chinese'}
              aria-label={locale === 'zh-CN' ? 'Switch to English' : 'Switch to Chinese'}
            >
              <Languages className="h-4 w-4" />
              <span>{locale === 'zh-CN' ? 'EN' : 'ZH'}</span>
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
              title={isDarkMode ? t('切换到浅色模式') : t('切换到深色模式')}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-400" />}
            </button>
            <div className="hidden items-center gap-2 text-xs font-medium text-slate-400 md:flex">
              <span>Workspace</span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>{new Date().getFullYear()}</span>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col p-3 md:p-5">
          <div className="tool-workspace min-h-0 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Suspense
              fallback={
                <div className="flex h-full min-h-[20rem] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-500">
                  {t('正在加载')} {t(activeTool.name)}...
                </div>
              }
            >
              <ActiveToolComponent />
            </Suspense>
          </div>

          <div className="mt-3 flex-none text-center text-xs text-slate-400">
            {t('程序员百宝箱')} &copy; {new Date().getFullYear()} • {t('专为开发者打造的效率工具箱')}
          </div>
        </div>
      </main>

      {/* Global Scratchpad Drawer Drawer */}
      {isScratchpadOpen && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setIsScratchpadOpen(false)}
        >
          <div 
            className="absolute right-0 top-0 bottom-0 w-80 sm:w-96 max-w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-850 shadow-2xl flex flex-col p-5 animate-in slide-in-from-right duration-250"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 flex-none">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary-500 animate-pulse" />
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t('全局数据暂存箱')}</h3>
                  <p className="text-[10px] text-slate-400">{t('临时保存文本/代码，打通所有 Studio')}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsScratchpadOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                aria-label={t('关闭全局数据暂存箱')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ScratchpadStorageHealth
              status={scratchpadStorageStatus}
              lastError={scratchpadStorageError}
              quota={scratchpadQuota}
              onRefresh={() => estimateScratchpadQuota().then(setScratchpadQuota)}
            />

            {/* Header controls bar for multi-select */}
            {scratchpadItems.length > 0 && (
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950 p-2 rounded-xl mt-2 flex-none border border-slate-150 dark:border-slate-850 text-xs">
                <button
                  onClick={() => {
                    setIsMultiSelectMode(!isMultiSelectMode);
                    setSelectedIds([]);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-primary-600 font-bold hover:bg-slate-150 dark:hover:bg-slate-850 transition-colors"
                >
                  {isMultiSelectMode ? t('常规模式') : t('开启打包多选')}
                </button>

                {isMultiSelectMode && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => {
                        if (validSelectedIds.length === scratchpadItems.length) {
                          setSelectedIds([]);
                        } else {
                          setSelectedIds(scratchpadItems.map(item => item.id));
                        }
                      }}
                      className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-250 transition-colors"
                    >
                      {validSelectedIds.length === scratchpadItems.length ? t('取消') : t('全选')}
                    </button>
                    <button
                      onClick={() => {
                        const itemsToZip = scratchpadItems.filter(item => validSelectedIds.includes(item.id));
                        handleExportZip(itemsToZip);
                      }}
                      disabled={validSelectedIds.length === 0}
                      className="px-2.5 py-1 rounded bg-primary-600 text-white font-bold disabled:bg-slate-200 disabled:dark:bg-slate-850 disabled:text-slate-400 hover:bg-primary-700 transition-colors flex items-center gap-1 active:scale-95 transition-transform"
                    >
                      <FolderArchive className="w-3.5 h-3.5" />
                      <span>ZIP ({validSelectedIds.length})</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 scrollbar-thin">
              {scratchpadItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-3">
                  <ClipboardList className="w-12 h-12 text-slate-300 dark:text-slate-800 stroke-1" />
                  <span className="font-bold">{t('暂存箱暂无内容')}</span>
                  <p className="text-[10px] text-slate-500 text-center max-w-[220px] leading-relaxed">
                    {t('您可以在 Mock数据、图片转换 等工具中直接点击“送入暂存箱”将数据保存到此处。')}
                  </p>
                </div>
              ) : (
                scratchpadItems.map(item => (
                    <ScratchpadItemCard 
                    key={item.id} 
                    item={item} 
                    onRemove={removeScratchpadItem} 
                    onUpdate={updateScratchpadItem}
                    isMultiSelectMode={isMultiSelectMode}
                    isSelected={validSelectedIds.includes(item.id)}
                    onToggleSelect={() => {
                      if (selectedIds.includes(item.id)) {
                        setSelectedIds(selectedIds.filter(id => id !== item.id));
                      } else {
                        setSelectedIds([...selectedIds, item.id]);
                      }
                    }}
                  />
                ))
              )}
            </div>

            {scratchpadItems.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex-none">
                <button
                  onClick={clearScratchpad}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 font-bold text-xs select-none transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('清空暂存箱')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite" aria-atomic="true">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border bg-white px-4 py-3 text-sm shadow-lg ${
              toast.tone === 'error'
                ? 'border-red-200 text-red-800'
                : toast.tone === 'success'
                  ? 'border-emerald-200 text-emerald-800'
                  : 'border-slate-200 text-slate-700'
            }`}
          >
            <div className="font-semibold">{t(toast.title)}</div>
            {toast.description && <div className="mt-1 text-xs opacity-80">{t(toast.description)}</div>}
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                className="mt-2 rounded-md border border-current px-2 py-1 text-xs font-semibold opacity-80 transition hover:opacity-100"
                onClick={toast.onAction}
              >
                {t(toast.actionLabel)}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const ScratchpadStorageHealth: React.FC<{
  status: 'ok' | 'degraded' | 'error';
  lastError?: string;
  quota: StorageEstimate | null;
  onRefresh: () => void;
}> = ({ status, lastError, quota, onRefresh }) => {
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
          {t('重新检测')}
        </button>
      </div>
    </div>
  );
};

const ScratchpadItemCard: React.FC<{
  item: ScratchpadItem;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<ScratchpadItem, 'name' | 'type' | 'mime' | 'sourceTool'>>) => void;
  isMultiSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}> = ({ item, onRemove, onUpdate, isMultiSelectMode, isSelected, onToggleSelect }) => {
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
                title={`${item.name} - 点击重命名`}
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
                  {t('SVG 矢量图')}
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
                title={t('复制')}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button 
                onClick={handleDownload}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                title={t('下载')}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => onRemove(item.id)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 transition-colors"
                title={t('删除')}
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
            <p className="text-slate-400 italic">[{t('大容量文本内容已存入本地 IndexedDB')}]</p>
            <p className="text-slate-500 font-bold mt-1">{t('大小')}: {formatFileSize(item.size)}</p>
          </div>
        ) : item.content ? (
          <div className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg font-mono text-[9px] text-slate-500 dark:text-slate-400 max-h-16 overflow-y-auto leading-relaxed select-all whitespace-pre-wrap break-all scrollbar-none">
            {item.content.slice(0, 180)}{item.content.length > 180 ? '...' : ''}
          </div>
        ) : (
          <div className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-lg font-mono text-[9px] text-slate-450 italic">
            {t('无内容预览')}
          </div>
        )}
      </div>
    </div>
  );
};
