import { ScratchpadStorageHealth, ScratchpadItemCard, normalizeScratchpadFileName, getScratchpadFallbackExt } from './components/tools/shared/ScratchpadCards';
import { readPreference, writePreference } from './components/tools/shared/browserStorage';
import { ToolErrorBoundary } from './components/tools/shared/ToolErrorBoundary';
import toolCatalog from './src/tool-catalog.json';
import { translateUi as tr, useLocaleRender } from './src/i18n/render';
import React, { Suspense, useEffect, useState, useMemo } from 'react';
import {
  LayoutGrid, Search, Menu, X, ChevronDown, ChevronRight, Sun, Moon, ClipboardList, Trash2, FolderArchive, Languages
} from 'lucide-react';
import { uniqueArchiveName } from './components/tools/shared/archive';
import { useScratchpadStore, getScratchpadItemContent } from './components/tools/shared/scratchpadStore';
import { Category, ToolDef } from './types';
import { TOOLS, TOOL_IDS, resolveToolRoute } from './components/tools/registry';
import { useI18n } from './src/i18n';
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
  const segments = getAppPathname().split('/').filter(Boolean).map(segment => { try { return decodeURIComponent(segment); } catch { return ''; } });
  const candidate = segments[0] === TOOL_ROUTE_PREFIX ? segments[1] : segments[0];

  const mapping = resolveToolRoute(candidate);
  if (mapping && candidate !== mapping.studioId) {
    window.history.replaceState(null, '', `${getBasePath()}/${TOOL_ROUTE_PREFIX}/${mapping.studioId}${mapping.subToolId ? `#${mapping.subToolId}` : window.location.hash}`);
    return mapping.studioId;
  }
  return candidate && TOOL_IDS.has(candidate) ? candidate : DEFAULT_TOOL_ID;
};

const getToolPath = (toolId: string, tabId?: string) => `${getBasePath()}/${TOOL_ROUTE_PREFIX}/${encodeURIComponent(toolId)}${tabId ? `#${encodeURIComponent(tabId)}` : ''}`;

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
  useLocaleRender();
  const { locale, toggleLocale, t } = useI18n();
  const [activeToolId, setActiveToolId] = useState<string>(() => getToolIdFromLocation());
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const [isDarkMode, setIsDarkMode] = useState(() => readPreference('theme') === 'dark');

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
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const usedNames = new Set<string>();
      for (const item of itemsToExport) {
        const ext = getScratchpadFallbackExt(item);
        const fileName = normalizeScratchpadFileName(item.name.includes('.') ? item.name : `${item.name}${ext}`, ext);
        const fileContent = await getScratchpadItemContent(item);
        zip.file(uniqueArchiveName(fileName, usedNames), fileContent);
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
      writePreference('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      writePreference('theme', 'light');
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

  const activateTool = (toolId: string, tabId?: string) => {
    setActiveToolId(toolId);

    const nextPath = getToolPath(toolId, tabId);
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath !== nextPath) {
      window.history.pushState(null, '', nextPath);
      if (toolId === activeToolId) window.dispatchEvent(new PopStateEvent('popstate'));
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
  const searchEntries: Array<ToolDef & { tabId?: string }> = search.trim() ? toolCatalog.map(entry => ({
    ...TOOLS.find(tool => tool.id === entry.studioId)!, name: entry.name, description: entry.description, tabId: entry.id,
  })) : TOOLS;
  const filteredTools = searchEntries.filter(tool =>
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
  }, {} as Record<string, Array<ToolDef & { tabId?: string }>>);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--surface-canvas)] font-sans text-slate-950">

      {/* Mobile Menu Overlay */}
      {!isSidebarOpen && (
        <button
          className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm md:hidden"
          onClick={() => setIsSidebarOpen(true)}
          aria-label={t(tr('打开工具目录'))}
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      )}

      {isSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label={t(tr('关闭工具目录遮罩'))}
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
            <div className="truncate text-base font-semibold tracking-normal text-slate-950">{tr("程序员百宝箱")}</div>
            <div className="text-xs font-medium text-slate-500">{TOOLS.length} {t(tr('个开发效率工具'))}</div>
          </div>
          <button
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label={t(tr('关闭工具目录'))}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-none border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t(tr('搜索工具...'))}
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
                      key={`${tool.id}#${tool.tabId || ''}`}
                      href={getToolPath(tool.id, tool.tabId)}
                      onClick={(event) => {
                        event.preventDefault();
                        activateTool(tool.id, tool.tabId);
                      }}
                      className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                        ${activeToolId === tool.id
                          ? 'bg-primary-50 text-primary-800 ring-1 ring-primary-100'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'}
                      `}
                      title={tr(`${t(tool.name)} - ${t(tool.description)}`)}
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
              {t(tr('未找到相关工具'))}
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
              aria-label={t(tr('打开工具目录'))}
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
              title={t(tr('打开全局数据暂存箱'))}
              aria-label={t(tr('打开全局数据暂存箱'))}
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
              title={tr(locale === 'zh-CN' ? 'Switch to English' : 'Switch to Chinese')}
              aria-label={tr(locale === 'zh-CN' ? 'Switch to English' : 'Switch to Chinese')}
            >
              <Languages className="h-4 w-4" />
              <span>{locale === 'zh-CN' ? 'EN' : 'ZH'}</span>
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
              title={tr(isDarkMode ? t('切换到浅色模式') : t('切换到深色模式'))}
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
                  {t(tr('正在加载'))} {t(activeTool.name)}...
                </div>
              }
            >
              <ToolErrorBoundary key={activeToolId}><ActiveToolComponent /></ToolErrorBoundary>
            </Suspense>
          </div>

          <div className="mt-3 flex-none text-center text-xs text-slate-400">
            {t(tr('程序员百宝箱'))} &copy; {new Date().getFullYear()} • {t(tr('专为开发者打造的效率工具箱'))}
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
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t(tr('全局数据暂存箱'))}</h3>
                  <p className="text-[10px] text-slate-400">{t(tr('临时保存文本/代码，打通所有 Studio'))}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsScratchpadOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                aria-label={t(tr('关闭全局数据暂存箱'))}
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
                  {isMultiSelectMode ? t(tr('常规模式')) : t(tr('开启打包多选'))}
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
                      {validSelectedIds.length === scratchpadItems.length ? t(tr('取消')) : t(tr('全选'))}
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
                  <span className="font-bold">{t(tr('暂存箱暂无内容'))}</span>
                  <p className="text-[10px] text-slate-500 text-center max-w-[220px] leading-relaxed">
                    {t(tr('您可以在 Mock数据、图片转换 等工具中直接点击“送入暂存箱”将数据保存到此处。'))}
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
                  <span>{t(tr('清空暂存箱'))}</span>
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
