import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState, useTransition, useRef, useId } from 'react';
import { LucideIcon, ChevronDown, Search, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { ToolErrorBoundary } from './ToolErrorBoundary';
import { useI18n } from '../../../src/i18n';

type EmptyProps = Record<string, never>;

export type PreloadableToolComponent = React.ComponentType<EmptyProps> & { preload?: () => Promise<void> };

type PreloadableLazyComponent = React.LazyExoticComponent<PreloadableToolComponent> & {
  preload: () => Promise<void>;
};

export const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => {
  let loadPromise: Promise<T> | null = null;
  const loadModule = () => {
    if (!loadPromise) {
      loadPromise = loader().catch((error) => {
        loadPromise = null;
        throw error;
      });
    }
    return loadPromise;
  };

  const lazyComponent = lazy(async () => {
    const module = await loadModule();
    return { default: module[exportName] as React.ComponentType<EmptyProps> };
  }) as PreloadableLazyComponent;

  lazyComponent.preload = () => loadModule().then(() => undefined);
  return lazyComponent;
};

export interface SubTool {
  id: string;
  name: string;
  description?: string;
  icon: LucideIcon;
  component: PreloadableToolComponent;
}

interface TabbedToolboxProps {
  title: string;
  description: string;
  tools: SubTool[];
  defaultTab?: string;
}

export const TabbedToolbox: React.FC<TabbedToolboxProps> = ({
  title,
  description,
  tools,
  defaultTab,
}) => {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [toolSearch, setToolSearch] = useState('');
  const catalogId = useId();
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const tabLookup = useMemo(() => new Map(tools.map(tool => [tool.id, tool])), [tools]);
  const isValidTab = useCallback((tabId: string | null | undefined) => {
    if (!tabId) return false;
    return tabLookup.has(tabId);
  }, [tabLookup]);

  const getTabFromLocation = useCallback(() => {
    const rawHash = window.location.hash.replace(/^#/, '');
    let hash = rawHash;
    try { hash = decodeURIComponent(rawHash); } catch { /* Fall back to the default tab for invalid encodings. */ }
    if (hash && isValidTab(hash)) {
      return hash;
    }

    const params = new URLSearchParams(window.location.search);
    const queryTab = params.get('tab');
    if (queryTab && isValidTab(queryTab)) {
      return queryTab;
    }

    return defaultTab && isValidTab(defaultTab) ? defaultTab : tools[0]?.id || '';
  }, [isValidTab, defaultTab, tools]);

  const [activeTabId, setActiveTabId] = useState<string>(() => getTabFromLocation());

  const syncLocation = useCallback((nextTabId: string, replace = false) => {
    const url = new URL(window.location.href);
    const encoded = encodeURIComponent(nextTabId);

    if (replace) {
      url.searchParams.delete('tab');
      url.hash = encoded;
      if (url.toString() !== window.location.href) {
        window.history.replaceState(null, '', url);
      }
      return;
    }

    if (window.location.hash !== `#${encoded}`) {
      url.hash = encoded;
      url.searchParams.delete('tab');
      window.history.pushState(null, '', url);
    }
  }, []);

  const syncTabFromLocation = useCallback(() => {
    const next = getTabFromLocation();
    setActiveTabId(previous => (previous === next ? previous : next));
    syncLocation(next, true);
  }, [getTabFromLocation, syncLocation]);

  const handleTabSelect = useCallback((id: string) => {
    if (!isValidTab(id) || id === activeTabId) return;

    startTransition(() => {
      setActiveTabId(id);
    });
    syncLocation(id, false);
    setCatalogOpen(false);
    setToolSearch('');
  }, [activeTabId, isValidTab, syncLocation]);

  useEffect(() => {
    // activeTabId is already initialized from the location, so only the URL
    // needs to be normalized on mount; subsequent drift is handled by listeners.
    syncLocation(getTabFromLocation(), true);

    window.addEventListener('hashchange', syncTabFromLocation);
    window.addEventListener('popstate', syncTabFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncTabFromLocation);
      window.removeEventListener('popstate', syncTabFromLocation);
    };
  }, [syncTabFromLocation, syncLocation, getTabFromLocation]);

  useEffect(() => {
    const activeTool = tools.find(t => t.id === activeTabId);
    void activeTool?.component.preload?.().catch(() => { /* The render boundary reports failed imports. */ });
  }, [activeTabId, tools]);

  const activeTool = tabLookup.get(activeTabId) || tools[0];
  const ActiveComponent = activeTool?.component;

  const activeIndex = tools.findIndex(tool => tool.id === activeTool?.id);
  const visibleTools = tools.filter(tool => `${t(tool.name)} ${t(tool.description || '')} ${tool.name} ${tool.id}`.toLowerCase().includes(toolSearch.toLowerCase().trim()));

  useEffect(() => {
    if (!catalogOpen) return;
    searchRef.current?.focus();
    const closeOutside = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setCatalogOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCatalogOpen(false);
        pickerRef.current?.querySelector<HTMLButtonElement>('[aria-controls]')?.focus();
      }
    };
    window.addEventListener('mousedown', closeOutside);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('mousedown', closeOutside);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [catalogOpen]);

  return (
    <div className="studio-shell flex h-full min-h-0 flex-col" aria-busy={isPending}>
      <div className="studio-picker" ref={pickerRef}>
        <div className="studio-picker-bar">
          <div className="studio-mobile-select md:hidden">
            <label className="sr-only" htmlFor="studio-tool-select">{t('选择工具')}</label>
            <select id="studio-tool-select" value={activeTool.id} onChange={event => handleTabSelect(event.target.value)}>
              {tools.map(tool => <option key={tool.id} value={tool.id}>{t(tool.name)}</option>)}
            </select>
          </div>
          <button className="studio-current hidden md:flex" aria-expanded={catalogOpen} aria-controls={catalogId} onClick={() => setCatalogOpen(value => !value)}>
            <span className="studio-current-icon"><activeTool.icon className="h-4 w-4" /></span>
            <span><strong>{t(activeTool.name)}</strong><small>{t(activeTool.description || title)}</small></span>
            <ChevronDown className={`h-4 w-4 shrink-0 ${catalogOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className="studio-picker-actions">
            <span className="studio-page-count">{String(activeIndex + 1).padStart(2, '0')} / {String(tools.length).padStart(2, '0')}</span>
            <button aria-label={t('上一个工具')} title={t('上一个工具')} disabled={activeIndex <= 0} onClick={() => handleTabSelect(tools[activeIndex - 1].id)}><ArrowLeft className="h-4 w-4" /></button>
            <button aria-label={t('下一个工具')} title={t('下一个工具')} disabled={activeIndex >= tools.length - 1} onClick={() => handleTabSelect(tools[activeIndex + 1].id)}><ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
        {catalogOpen && <section className="studio-catalog" id={catalogId} aria-label={t('工作室工具目录')}>
          <div className="studio-catalog-search"><Search className="h-4 w-4" /><input ref={searchRef} value={toolSearch} onChange={event => setToolSearch(event.target.value)} placeholder={t('查找当前工作室的工具...')} aria-label={t('查找当前工作室的工具')} /><button aria-label={t('关闭工具目录')} onClick={() => setCatalogOpen(false)}><X className="h-4 w-4" /></button></div>
          <div className="studio-catalog-grid">{visibleTools.map(tool => <button key={tool.id} aria-pressed={tool.id === activeTool.id} onClick={() => { if (tool.id === activeTool.id) setCatalogOpen(false); else handleTabSelect(tool.id); }}>
            <tool.icon className="h-4 w-4" /><span><strong>{t(tool.name)}</strong><small>{t(tool.description || '')}</small></span>
          </button>)}</div>
          {!visibleTools.length && <p className="p-5 text-center text-sm text-slate-500">{t('未找到相关工具')}</p>}
        </section>}
      </div>
      <div className="studio-content flex-1 min-h-0 overflow-y-auto">
        <div className="studio-page h-full min-h-0 flex flex-col" key={activeTool.id}>
          {isPending && <div className="workflow-notice" role="status">{t('正在加载')} {t(activeTool.name)}...</div>}
          {ActiveComponent ? <Suspense fallback={
            <div className="workspace-loading"><span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />{t('正在加载')} {t(activeTool.name)}...</div>
          }><ToolErrorBoundary key={activeTool.id}><ActiveComponent /></ToolErrorBoundary></Suspense> : <div className="workspace-loading">{t('未加载工具组件')}</div>}
        </div>
      </div>
      <span className="sr-only">{t(description)}</span>
    </div>
  );
};
