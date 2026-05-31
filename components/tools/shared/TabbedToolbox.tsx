import React, { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { LucideIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

type EmptyProps = Record<string, never>;

export const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] as React.ComponentType<EmptyProps> }));

export interface SubTool {
  id: string;
  name: string;
  description?: string;
  icon: LucideIcon;
  component: React.ComponentType<EmptyProps>;
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
  const getFallbackTab = useCallback(() => (
    defaultTab && tools.some(t => t.id === defaultTab)
      ? defaultTab
      : (tools[0]?.id || '')
  ), [defaultTab, tools]);

  const getTabFromLocation = useCallback(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && tools.some(t => t.id === hash)) {
      return hash;
    }

    const params = new URLSearchParams(window.location.search);
    const queryTab = params.get('tab');
    if (queryTab && tools.some(t => t.id === queryTab)) {
      return queryTab;
    }

    return getFallbackTab();
  }, [getFallbackTab, tools]);

  const [activeTabId, setActiveTabId] = useState<string>(() => getTabFromLocation());

  // Keep tab state aligned with hash navigation and history entries created by pushState.
  useEffect(() => {
    const syncActiveTabFromLocation = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && tools.some(t => t.id === hash)) {
        setActiveTabId(hash);
        return;
      }

      const nextTab = getTabFromLocation();
      setActiveTabId(nextTab);

      if (hash && !tools.some(t => t.id === hash)) {
        window.history.replaceState(null, '', `#${encodeURIComponent(nextTab)}`);
      }
    };

    syncActiveTabFromLocation();
    window.addEventListener('hashchange', syncActiveTabFromLocation);
    window.addEventListener('popstate', syncActiveTabFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncActiveTabFromLocation);
      window.removeEventListener('popstate', syncActiveTabFromLocation);
    };
  }, [getTabFromLocation, tools]);

  const handleTabSelect = (id: string) => {
    setActiveTabId(id);
    
    // Set URL hash cleanly without jumping the page
    const nextHash = `#${encodeURIComponent(id)}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash);
    }
  };

  const activeTool = tools.find(t => t.id === activeTabId) || tools[0];
  const ActiveComponent = activeTool?.component;

  return (
    <div className="flex h-full flex-col min-h-0 bg-[var(--surface-canvas)]">
      {/* Premium Tab Bar Wrapper */}
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
                  onClick={() => handleTabSelect(tool.id)}
                  className={twMerge(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 select-none",
                    isActive
                      ? "bg-primary-50 text-primary-700 shadow-sm ring-1 ring-primary-100 dark:bg-primary-950/40 dark:text-primary-400 dark:ring-primary-900/50"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
                  )}
                  title={tool.description}
                >
                  <Icon className={twMerge(
                    "w-4 h-4 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-primary-600 dark:text-primary-400" : "text-slate-400 dark:text-slate-500"
                  )} />
                  <span>{tool.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toolbox Workbench with lazy suspension */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        <div className="h-full min-h-0 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col">
          {/* Subtle, premium header bar inside the tab content */}
          <div className="mb-4 flex-none rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
              {title} • {activeTool.name}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {description} — 当前工具：{activeTool.description || activeTool.name}
            </p>
          </div>

          <div className="flex-1 min-h-0">
            {ActiveComponent ? (
              <Suspense
                fallback={
                  <div className="flex h-full min-h-[25rem] items-center justify-center rounded-xl border border-slate-200/60 bg-white/50 dark:border-slate-800/60 dark:bg-slate-900/50 text-sm font-medium text-slate-500 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
                      <span>正在加载 {activeTool.name}...</span>
                    </div>
                  </div>
                }
              >
                <ActiveComponent />
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900 text-sm text-slate-400">
                未加载工具组件
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
