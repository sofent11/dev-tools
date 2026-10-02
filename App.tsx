import React, { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import {
  Search, Menu, X, ChevronDown, ChevronRight, Sun, Moon, ClipboardList, Trash2, Download, Copy, Check, FolderArchive, Languages, ArrowUpRight, Command
} from 'lucide-react';
import JSZip from 'jszip';
import { useScratchpadStore, getScratchpadItemContent, type ScratchpadItem } from './components/tools/shared/scratchpadStore';
import { sanitizeSvgMarkup } from './components/tools/shared/sanitizeMarkup';
import { notifyToast } from './components/tools/shared/notifyToast';
import { Category, ToolDef } from './types';
import { TOOLS, TOOL_IDS, resolveToolRoute } from './components/tools/registry';
import { useI18n } from './src/i18n';
import { TOOL_PAGES } from './components/tools/toolCatalog';

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
    if (mapping.isLegacy && mapping.subToolId) {
      const { studioId, subToolId } = mapping;
      const targetPath = `${getBasePath()}/${TOOL_ROUTE_PREFIX}/${studioId}`;
      window.history.replaceState(null, '', `${targetPath}#${subToolId}`);
      return studioId;
    }

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
  tone?: 'success' | 'error' | 'info';
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
  const catalogId = 'tool-catalog';
  const sidebarRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Zustand Global Scratchpad Store State
  const [isScratchpadOpen, setIsScratchpadOpen] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const scratchpadItems = useScratchpadStore((state) => state.items);
  const removeScratchpadItem = useScratchpadStore((state) => state.removeItem);
  const updateScratchpadItem = useScratchpadStore((state) => state.updateItem);
  const clearScratchpad = useScratchpadStore((state) => state.clearAll);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDarkMode ? '#171c18' : '#f4f3eb');
  }, [isDarkMode]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const syncSidebar = () => setIsSidebarOpen(media.matches);
    media.addEventListener('change', syncSidebar);
    return () => media.removeEventListener('change', syncSidebar);
  }, []);

  useEffect(() => {
    if (!isSidebarOpen || window.matchMedia('(min-width: 768px)').matches) return;
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
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isScratchpadOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsScratchpadOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScratchpadOpen]);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastMessage, 'id'>>).detail;
      const toast: ToastMessage = {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        tone: detail?.tone || 'info',
        title: detail?.title || '',
        description: detail?.description,
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

  const matchingPages = search.trim() ? TOOL_PAGES.filter(page => `${page.name} ${t(page.name)} ${page.id}`.toLowerCase().includes(search.trim().toLowerCase())) : [];

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
        inert={!isSidebarOpen}
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
            <span>{TOOLS.length} {t('个开发效率工具')}</span>
            <span data-i18n-skip>↗</span>
          </div>
        </div>
      </aside>

      <main className="app-main" inert={isSidebarOpen && window.innerWidth < 768}>
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
              <ActiveToolComponent />
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
          </div>
        ))}
      </div>
    </div>
  );
}

const ScratchpadItemCard: React.FC<{
  item: ScratchpadItem;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<ScratchpadItem, 'name' | 'type' | 'mime' | 'sourceTool' | 'expiresAt'>>) => void;
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
      notifyToast({
        title: '复制失败',
        description: (err as Error).message,
        tone: 'error',
      });
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
      notifyToast({
        title: '下载失败',
        description: (err as Error).message,
        tone: 'error',
      });
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
              {item.sensitive && (
                <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/35 px-1 py-0.2 rounded text-[8px] font-bold">
                  {t('敏感')} {item.expiresAt ? `· ${t('自动过期')}` : ''}
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
