import React, { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import {
  Search, Menu, X, ChevronDown, ChevronRight, Sun, Moon, ClipboardList, Trash2, FolderArchive, Languages, ArrowUpRight, Command
} from 'lucide-react';
import { ScratchpadStorageHealth, ScratchpadItemCard, normalizeScratchpadFileName, getScratchpadFallbackExt } from './components/tools/shared/ScratchpadCards';
import { readPreference, writePreference } from './components/tools/shared/browserStorage';
import { ToolErrorBoundary } from './components/tools/shared/ToolErrorBoundary';
import { uniqueArchiveName } from './components/tools/shared/archive';
import { useScratchpadStore, getScratchpadItemContent } from './components/tools/shared/scratchpadStore';
import { notifyToast, type ToastTone } from './components/tools/shared/notifyToast';
import { Category, ToolDef } from './types';
import { TOOLS, TOOL_IDS, resolveToolRoute } from './components/tools/registry';
import { useI18n } from './src/i18n';
import toolCatalog from './src/tool-catalog.json';

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
  const segments = getAppPathname().split('/').filter(Boolean).map(segment => { try { return decodeURIComponent(segment); } catch { return segment; } });
  const candidate = segments[0] === TOOL_ROUTE_PREFIX ? segments[1] : segments[0];

  const mapping = resolveToolRoute(candidate);
  if (mapping) {
    if (candidate !== mapping.studioId) {
      const targetPath = `${getBasePath()}/${TOOL_ROUTE_PREFIX}/${mapping.studioId}`;
      window.history.replaceState(null, '', `${targetPath}${mapping.subToolId ? `#${mapping.subToolId}` : window.location.hash}`);
    }
    return mapping.studioId;
  }

  return candidate && TOOL_IDS.has(candidate) ? candidate : DEFAULT_TOOL_ID;
};

const getToolPath = (toolId: string) => `${getBasePath()}/${TOOL_ROUTE_PREFIX}/${encodeURIComponent(toolId)}`;

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

  const [isDarkMode, setIsDarkMode] = useState(() => readPreference('theme') === 'dark');
  const catalogId = 'tool-catalog';
  const sidebarRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Zustand Global Scratchpad Store State
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const scratchpadDialogRef = useRef<HTMLDivElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const scratchpadItems = useScratchpadStore((state) => state.items);
  const scratchpadStorageStatus = useScratchpadStore(state => state.storageStatus);
  const scratchpadStorageError = useScratchpadStore(state => state.lastStorageError);
  const estimateScratchpadQuota = useScratchpadStore(state => state.estimateQuota);
  const [scratchpadQuota, setScratchpadQuota] = useState<StorageEstimate | null>(null);
  const removeScratchpadItem = useScratchpadStore((state) => state.removeItem);
  const updateScratchpadItem = useScratchpadStore((state) => state.updateItem);
  const clearScratchpad = useScratchpadStore((state) => state.clearAll);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const validSelectedIds = useMemo(() => {
    const availableIds = new Set(scratchpadItems.map(item => item.id));
    return selectedIds.filter(id => availableIds.has(id));
  }, [scratchpadItems, selectedIds]);

  const handleExportZip = async (itemsToExport: typeof scratchpadItems) => {
    if (itemsToExport.length === 0 || isExporting) return;
    setIsExporting(true);
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
    } finally { setIsExporting(false); }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      writePreference('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      writePreference('theme', 'light');
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDarkMode ? '#171c18' : '#f4f3eb');
  }, [isDarkMode]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const syncSidebar = () => setIsSidebarOpen(media.matches);
    media.addEventListener('change', syncSidebar);
    return () => media.removeEventListener('change', syncSidebar);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen || isScratchpadOpen || window.matchMedia('(min-width: 768px)').matches) return;
    const menuButton = menuButtonRef.current;
    const focusFrame = window.requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }));

    const handleCatalogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsSidebarOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled])',
      ) || []).filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener('keydown', handleCatalogKeyDown);
    return () => {
      window.removeEventListener('keydown', handleCatalogKeyDown);
      window.cancelAnimationFrame(focusFrame);
      if (menuButton?.getClientRects().length) menuButton.focus({ preventScroll: true });
    };
  }, [isSidebarOpen, isScratchpadOpen]);

  useEffect(() => {
    if (!isScratchpadOpen) return;
    void estimateScratchpadQuota().then(setScratchpadQuota);

    const opener = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => scratchpadDialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setIsScratchpadOpen(false); setConfirmClear(false); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(scratchpadDialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], select') || []).filter(control => control.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); cancelAnimationFrame(frame); if (opener?.getClientRects().length) opener.focus(); };
  }, [isScratchpadOpen, estimateScratchpadQuota]);

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

  const activateTool = (toolId: string, subToolId?: string) => {
    setActiveToolId(toolId);

    const nextPath = `${getToolPath(toolId)}${subToolId ? `#${encodeURIComponent(subToolId)}` : ''}`;
    const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (currentPath !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }

    if (activeToolId === toolId && subToolId) window.dispatchEvent(new HashChangeEvent('hashchange'));
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const matchingPages = search.trim() ? toolCatalog.filter(page => `${page.name} ${t(page.name)} ${page.description} ${t(page.description)} ${page.id}`.toLowerCase().includes(search.trim().toLowerCase())) : [];

  // Group tools by category
  const filteredTools = TOOLS.filter(tool =>
    tool.name.toLowerCase().includes(search.toLowerCase()) ||
    tool.description.toLowerCase().includes(search.toLowerCase()) ||
    translateTextForSearch(tool.name, search, t) ||
    translateTextForSearch(tool.description, search, t) ||
    matchingPages.some(page => page.studioId === tool.id)
  );

  // Ensure order of categories based on Enum definition or custom order
  const categoryOrder = Object.values(Category);

  const groupedTools = categoryOrder.reduce((acc, cat) => {
    const tools = filteredTools.filter(t => t.category === cat);
    if (tools.length > 0) acc[cat] = tools;
    return acc;
  }, {} as Record<string, ToolDef[]>);

  const studioNumber = String(TOOLS.findIndex(tool => tool.id === activeTool.id) + 1).padStart(2, '0');

  return (
    <div className="app-shell" data-i18n-root>
      {isSidebarOpen && (
        <button
          className="catalog-overlay md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label={t('关闭工具目录遮罩')}
        />
      )}

      <aside
        id={catalogId}
        ref={sidebarRef}
        aria-label={t('工具目录')}
        className={`app-sidebar ${isSidebarOpen ? 'is-open' : ''}`}
        inert={!isSidebarOpen || isScratchpadOpen}
      >
        <div className="sidebar-brand">
          <div className="brand-eyebrow" data-i18n-skip>
            <span>THE DEVELOPER’S ATELIER</span>
            <Command className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="brand-wordmark" data-i18n-skip>Toolbox<span>.</span></div>
          <div className="brand-caption">
            <span>{t('程序员百宝箱')}</span>
            <span className="brand-edition" data-i18n-skip>VOL. 01</span>
          </div>
          <button
            className="sidebar-close md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label={t('关闭工具目录')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="sidebar-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            type="search"
            ref={searchRef}
            aria-label={t('搜索工具')}
            placeholder={t('搜索工作室或工具...')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <span className="search-mark" aria-hidden="true">/</span>
        </div>

        <nav className="app-scrollbar sidebar-catalog">
          {Object.entries(groupedTools).map(([category, tools]) => (
            <div className="catalog-group" key={category}>
              <h3 className="catalog-heading">
                <button
                  type="button"
                  aria-expanded={!collapsedCategories[category]}
                  aria-controls={`tool-group-${category}`}
                  onClick={() => toggleCategory(category)}
                >
                  <span className="category-number" aria-hidden="true">
                    {String(categoryOrder.indexOf(category as Category) + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{t(category)}</span>
                  <span className="category-count">{tools.length}</span>
                  {collapsedCategories[category]
                    ? <ChevronRight className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />}
                </button>
              </h3>
              {!collapsedCategories[category] && (
                <div id={`tool-group-${category}`} className="catalog-tools">
                  {tools.map(tool => (
                    <React.Fragment key={tool.id}>
                    <a
                      href={getToolPath(tool.id)}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        activateTool(tool.id);
                      }}
                      className="catalog-tool"
                      aria-current={activeToolId === tool.id ? 'page' : undefined}
                      title={`${t(tool.name)} - ${t(tool.description)}`}
                    >
                      <tool.icon className="catalog-tool-icon" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <span className="catalog-tool-name">{t(tool.name)}</span>
                        <span className="catalog-tool-description">{t(tool.description)}</span>
                      </div>
                      {activeToolId === tool.id && <ArrowUpRight className="h-3.5 w-3.5 flex-none" aria-hidden="true" />}
                    </a>
                    {matchingPages.filter(page => page.studioId === tool.id).map(page => (
                      <a key={page.id} className="catalog-page-link" href={`${getToolPath(tool.id)}#${page.id}`} onClick={event => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault(); activateTool(tool.id, page.id);
                      }}><span>{t(page.name)}</span><ArrowUpRight className="h-3 w-3" /></a>
                    ))}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
          {Object.keys(groupedTools).length === 0 && (
            <div className="catalog-empty">{t('未找到相关工具')}</div>
          )}
        </nav>

        <div className="sidebar-colophon">
          <div className="colophon-top">
            <span className="theme-swatches" aria-hidden="true"><i /><i /><i /></span>
            <span data-i18n-skip>LESS FRICTION. MORE FLOW.</span>
          </div>
          <div className="colophon-bottom">
            <span>{TOOLS.length} {t('个工作室')} · {toolCatalog.length} {t('个工具')}</span>
            <span data-i18n-skip>↗</span>
          </div>
        </div>
      </aside>

      <main className="app-main" inert={isScratchpadOpen || (isSidebarOpen && window.innerWidth < 768)}>
        <header className="workspace-header">
          <div className="workspace-heading">
            <div className="workspace-eyebrow">
              <button
                className="shell-action mobile-menu md:hidden"
                ref={menuButtonRef}
                onClick={() => setIsSidebarOpen(true)}
                aria-label={t('打开工具目录')}
                aria-expanded={isSidebarOpen}
                aria-controls={catalogId}
              >
                <Menu className="h-4 w-4" />
              </button>
              <span data-i18n-skip>WORKSPACE / {studioNumber}</span>
              <span className="eyebrow-divider" aria-hidden="true" />
              <span>{t(activeTool.category)}</span>
            </div>
            <h1>{t(activeTool.name)}<span className="heading-period" aria-hidden="true">.</span></h1>
            <p>{t(activeTool.description)}</p>
          </div>
          <div className="workspace-actions">
            <button
              onClick={() => setIsScratchpadOpen(true)}
              className="shell-action scratchpad-action"
              title={t('打开全局数据暂存箱')}
              aria-label={t('打开全局数据暂存箱')}
            >
              <ClipboardList className="h-4 w-4" />
              <span className="hidden lg:inline">{t('暂存箱')}</span>
              {scratchpadItems.length > 0 && <span className="scratchpad-count">{scratchpadItems.length}</span>}
            </button>
            <span className="action-divider" aria-hidden="true" />
            <button
              onClick={toggleLocale}
              className="shell-action locale-action"
              title={locale === 'zh-CN' ? 'Switch to English' : 'Switch to Chinese'}
              aria-label={locale === 'zh-CN' ? 'Switch to English' : 'Switch to Chinese'}
            >
              <Languages className="h-4 w-4" />
              <span>{locale === 'zh-CN' ? 'EN' : 'ZH'}</span>
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="shell-action theme-action"
              title={isDarkMode ? t('切换到浅色模式') : t('切换到深色模式')}
              aria-label={isDarkMode ? t('切换到浅色模式') : t('切换到深色模式')}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <div className="workspace-body">
          <div className="tool-workspace min-h-0 flex-1">
            <Suspense fallback={
              <div className="workspace-loading">{t('正在加载')} {t(activeTool.name)}...</div>
            }>
              <ToolErrorBoundary key={activeToolId}><ActiveToolComponent /></ToolErrorBoundary>
            </Suspense>
          </div>
          <footer className="workspace-footer">
            <span>{t('专为开发者打造的效率工具箱')}</span>
            <span data-i18n-skip>TOOLBOX ATELIER © {new Date().getFullYear()}</span>
          </footer>
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
            ref={scratchpadDialogRef} role="dialog" aria-modal="true" aria-label={t("全局数据暂存箱")} onClick={e => e.stopPropagation()}
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

            <ScratchpadStorageHealth status={scratchpadStorageStatus} lastError={scratchpadStorageError} quota={scratchpadQuota} onRefresh={() => { void estimateScratchpadQuota().then(setScratchpadQuota); }} />
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
                      disabled={validSelectedIds.length === 0 || isExporting}
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
                  onClick={() => { if (confirmClear) { clearScratchpad(); setConfirmClear(false); } else setConfirmClear(true); }}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 font-bold text-xs select-none transition-all active:scale-95"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t(confirmClear ? '确认清空全部暂存内容' : '清空暂存箱')}</span>
                </button>
                {confirmClear && <button className="mt-2 w-full text-xs text-slate-500" onClick={() => setConfirmClear(false)}>{t("取消")}</button>}
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
            {toast.actionLabel && toast.onAction && <button className="mt-2 font-semibold underline" onClick={() => { toast.onAction?.(); setToasts(previous => previous.filter(item => item.id !== toast.id)); }}>{t(toast.actionLabel)}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
