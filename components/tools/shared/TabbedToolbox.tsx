import React, { lazy, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { LucideIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { useI18n } from '../../src/i18n';

type EmptyProps = Record<string, never>;

export type PreloadableToolComponent = React.ComponentType<EmptyProps> & { preload?: () => Promise<void> };

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
  }) as React.LazyExoticComponent<PreloadableToolComponent>;

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
  const tabLookup = useMemo(() => new Map(tools.map(tool => [tool.id, tool])), [tools]);
  const isValidTab = useCallback((tabId: string | null | undefined) => {
    if (!tabId) return false;
    return tabLookup.has(tabId);
  }, [tabLookup]);

  const getTabFromLocation = useCallback(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && isValidTab(decodeURIComponent(hash))) {
      return decodeURIComponent(hash);
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
  }, [activeTabId, isValidTab, syncLocation]);

  useEffect(() => {
    syncTabFromLocation();

    window.addEventListener('hashchange', syncTabFromLocation);
    window.addEventListener('popstate', syncTabFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncTabFromLocation);
      window.removeEventListener('popstate', syncTabFromLocation);
    };
  }, [syncTabFromLocation]);

  useEffect(() => {
    const activeTool = tools.find(t => t.id === activeTabId);
    activeTool?.component.preload?.();
  }, [activeTabId, tools]);

  const activeTool = tabLookup.get(activeTabId) || tools[0];
  const ActiveComponent = activeTool?.component;

  return (
    <div className="flex h-full flex-col min-h-0 bg-[var(--surface-canvas)]">
      <div className="flex-none border-b border-slate-200 bg-white/50 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/50 sticky top-0 z-20">
        <div className="flex items-center justify-between px-6 py-2 overflow-x-auto scrollbar-none">
          <div className="flex gap-2 min-w-max py-1">
            {tools.map(tool => {
              const isActive = tool.id === activeTabId;
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onMouseEnter={() => tool.component.preload?.()}
                  onFocus={() => tool.component.preload?.()}
                  onClick={() => handleTabSelect(tool.id)}
                  className={twMerge(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 select-none",
                    isActive
                      ? "bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-100 dark:bg-primary-950/40 dark:text-primary-400 dark:ring-primary-900/50"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
                  )}
                  title={t(tool.description || '')}
                >
                  <Icon className={twMerge(
                    "w-4 h-4 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-500"
                  )} />
                  <span>{t(tool.name)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        <div className="h-full min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col">
          <div className="mb-4 flex-none rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              {t(title)} • {t(activeTool.name)}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t(description)} — {t('当前工具')}：{t(activeTool.description || activeTool.name)}
            </p>
          </div>

          <div className="flex-1 min-h-0">
            {isPending && (
              <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                {t('正在加载')} {t(activeTool.name)}...
              </div>
            )}
            {ActiveComponent ? (
              <Suspense
                fallback={
                  <div className="flex h-full min-h-[25rem] items-center justify-center rounded-xl border border-slate-200/60 bg-white/50 dark:border-slate-800/60 dark:bg-slate-900/50 text-sm font-medium text-slate-500 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                      <span>{t('正在加载')} {t(activeTool.name)}...</span>
                    </div>
                  </div>
                }
              >
                <ActiveComponent />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-sm text-slate-400">
                {t('未加载工具组件')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
