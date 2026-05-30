import React, { Suspense, useEffect, useState } from 'react';
import {
  LayoutGrid, Search, Menu, X, ChevronDown, ChevronRight, Sun, Moon
} from 'lucide-react';
import { Category, ToolDef } from './types';
import { TOOLS, TOOL_IDS, LEGACY_TOOL_MAP } from './components/tools/registry';

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

export default function App() {
  const [activeToolId, setActiveToolId] = useState<string>(() => getToolIdFromLocation());
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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
    document.title = `${activeTool.name} - 程序员百宝箱`;
  }, [activeTool.name]);

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
  const filteredTools = TOOLS.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
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
          aria-label="打开工具目录"
        >
          <Menu className="w-5 h-5 text-slate-600" />
        </button>
      )}

      {isSidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="关闭工具目录遮罩"
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
            <div className="text-xs font-medium text-slate-500">{TOOLS.length} 个开发效率工具</div>
          </div>
          <button
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="关闭工具目录"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-none border-b border-slate-100 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="搜索工具..."
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
                  <span className="flex-1 text-left truncate">{category}</span>
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
                      title={`${tool.name} - ${tool.description}`}
                    >
                      <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg border
                        ${activeToolId === tool.id ? 'border-primary-100 bg-white text-primary-700' : 'border-slate-100 bg-white text-slate-400 group-hover:text-slate-700'}
                      `}>
                        <tool.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-medium">{tool.name}</span>
                        <span className="block truncate text-xs text-slate-400 group-hover:text-slate-500">{tool.description}</span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}

          {Object.keys(groupedTools).length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
              未找到相关工具
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
              aria-label="打开工具目录"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg border border-primary-100 bg-primary-50 text-primary-700">
              <activeTool.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="truncate text-lg font-semibold tracking-normal text-slate-950">{activeTool.name}</h1>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                  {activeTool.category}
                </span>
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-500">{activeTool.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 ml-auto md:ml-0">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
              title={isDarkMode ? "切换到浅色模式" : "切换到深色模式"}
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
                  正在加载 {activeTool.name}...
                </div>
              }
            >
              <ActiveToolComponent />
            </Suspense>
          </div>

          <div className="mt-3 flex-none text-center text-xs text-slate-400">
            程序员百宝箱 &copy; {new Date().getFullYear()} • 专为开发者打造的效率工具箱
          </div>
        </div>
      </main>
    </div>
  );
}
