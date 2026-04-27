import React, { useEffect, useState } from 'react';
import {
  FileJson, Type, Link, Clock, Shield, Fingerprint,
  Hash, Sparkles, LayoutGrid, Search, Menu, X,
  CaseUpper, AlignLeft, Regex, Palette, ArrowRightLeft,
  QrCode, Monitor, Terminal, KeyRound, Globe, Code,
  FileCode, Database, FileSpreadsheet, FileText, Scissors,
  Send, Calculator, Image, Files, Gem, UserRoundCog, Ruler,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { Category, ToolDef } from './types';
import { JsonTool, Base64Tool, UrlTool } from './components/tools/FormatConverters';
import { JwtTool, UuidTool, HashTool, PasswordGenTool, HmacTool } from './components/tools/SecurityTools';
import { AiAssistant } from './components/tools/AiAssistant';
import { CaseConverterTool, TextStatsTool, RegexTool } from './components/tools/TextTools';
import { PxRemTool, ColorConverterTool, QrCodeTool, DeviceInfoTool } from './components/tools/WebTools';
import { ChmodTool } from './components/tools/DevOpsTools';
import { StringEscaper } from './components/tools/StringEscaper';
import { UrlParser } from './components/tools/UrlParser';
import { DiffViewer } from './components/tools/DiffViewer';
import { XmlTool, YamlTool, CsvTool, MarkdownTool } from './components/tools/FormatTools';
import { StringManipulatorTool, SlugTool, RandomStringTool } from './components/tools/StringTools';
import { TimestampTool, DateDiffTool } from './components/tools/TimeTools';
import { HttpBuilderTool, UserAgentTool, IpInfoTool } from './components/tools/NetworkTools';
import { JsonToTsTool } from './components/tools/JsonToTsTool';
import { ImageTools } from './components/tools/ImageTools';
import { HeadshotExtractor } from './components/tools/HeadshotExtractor';
import { PdfTools } from './components/tools/PdfTools';
import JewelryCustomizer from './components/tools/JewelryCustomizer';
import { FaceSwapTool } from './components/tools/FaceSwapTool';
import SmartGeometryTool from './components/tools/SmartGeometry';

// Tool Registry
const TOOLS: ToolDef[] = [
  // --- Category 1: Encoding / Text Processing (TEXT) ---
  { id: 'json', name: 'JSON 格式化', description: '美化与压缩', icon: FileJson, category: Category.TEXT, component: JsonTool },
  { id: 'json2ts', name: 'JSON 转代码', description: '转 TS/Go/Java', icon: Code, category: Category.TEXT, component: JsonToTsTool },
  { id: 'xml', name: 'XML 工具', description: '格式化 / JSON 转换', icon: FileCode, category: Category.TEXT, component: XmlTool },
  { id: 'yaml', name: 'YAML ↔ JSON', description: 'YAML / JSON 互转', icon: Database, category: Category.TEXT, component: YamlTool },
  { id: 'csv', name: 'CSV ↔ JSON', description: 'CSV / JSON 互转', icon: FileSpreadsheet, category: Category.TEXT, component: CsvTool },
  { id: 'base64', name: 'Base64 转换', description: '编码与解码', icon: Type, category: Category.TEXT, component: Base64Tool },
  { id: 'url', name: 'URL 编码', description: 'URL 参数转义', icon: Link, category: Category.TEXT, component: UrlTool },
  { id: 'escape', name: 'HTML/Uni 转义', description: 'HTML / Unicode', icon: Code, category: Category.TEXT, component: StringEscaper },
  { id: 'markdown', name: 'Markdown 预览', description: 'Markdown 转 HTML', icon: FileText, category: Category.TEXT, component: MarkdownTool },
  { id: 'case', name: '大小写转换', description: '驼峰/下划线/大写', icon: CaseUpper, category: Category.TEXT, component: CaseConverterTool },
  { id: 'text-manip', name: '文本处理', description: '去重/排序/全半角', icon: Scissors, category: Category.TEXT, component: StringManipulatorTool },
  { id: 'slug', name: 'Slug 生成', description: '标题转 URL Slug', icon: Link, category: Category.TEXT, component: SlugTool },
  { id: 'stats', name: '文本统计', description: '字数/行数统计', icon: AlignLeft, category: Category.TEXT, component: TextStatsTool },
  { id: 'regex', name: '正则测试', description: 'JS 正则表达式测试', icon: Regex, category: Category.TEXT, component: RegexTool },
  { id: 'diff', name: '文本对比', description: '简易行对比', icon: ArrowRightLeft, category: Category.TEXT, component: DiffViewer },

  // --- Category 2: Time / Date (TIME) ---
  { id: 'timestamp', name: '时间戳转换', description: 'Unix 时间戳互转', icon: Clock, category: Category.TIME, component: TimestampTool },
  { id: 'datediff', name: '日期计算', description: '日期差值计算', icon: Calculator, category: Category.TIME, component: DateDiffTool },
  // { id: 'time', name: 'Old Time', description: 'Deprecated', icon: Clock, category: Category.TIME, component: TimeTool }, // Keeping new ones preferred

  // --- Category 3: Network / Web (NETWORK) ---
  { id: 'http', name: 'HTTP 请求', description: '简易 HTTP Client', icon: Send, category: Category.NETWORK, component: HttpBuilderTool },
  { id: 'urlparser', name: 'URL 解析器', description: '解析 URL 结构', icon: Globe, category: Category.NETWORK, component: UrlParser },
  { id: 'useragent', name: 'User Agent', description: 'UA 解析', icon: Monitor, category: Category.NETWORK, component: UserAgentTool },
  { id: 'ip', name: 'IP 信息', description: '本机 IP 查询', icon: Globe, category: Category.NETWORK, component: IpInfoTool },
  { id: 'device', name: '设备信息', description: '浏览器/系统参数', icon: Monitor, category: Category.NETWORK, component: DeviceInfoTool },

  // --- Category 4: Security (SECURITY) ---
  { id: 'jwt', name: 'JWT 解析', description: '查看 Token 载荷', icon: Shield, category: Category.SECURITY, component: JwtTool },
  { id: 'hash', name: 'Hash 生成', description: 'SHA1, SHA256, SHA512', icon: Hash, category: Category.SECURITY, component: HashTool },
  { id: 'hmac', name: 'HMAC 计算', description: 'HMAC-SHA256 计算', icon: Shield, category: Category.SECURITY, component: HmacTool },
  { id: 'password', name: '密码生成', description: '高强度随机密码', icon: KeyRound, category: Category.SECURITY, component: PasswordGenTool },

  // --- Category 7: Frontend (FRONTEND) ---
  { id: 'pxrem', name: 'PX/REM 转换', description: 'CSS 单位计算', icon: ArrowRightLeft, category: Category.FRONTEND, component: PxRemTool },
  { id: 'color', name: '颜色转换', description: 'Hex / RGB 互转', icon: Palette, category: Category.FRONTEND, component: ColorConverterTool },
  { id: 'qrcode', name: '二维码生成', description: '文本转二维码图片', icon: QrCode, category: Category.FRONTEND, component: QrCodeTool },
  { id: 'image', name: '图片压缩/转换', description: '压缩 / 格式转换', icon: Image, category: Category.FRONTEND, component: ImageTools },
  { id: 'headshot', name: '大头照提取', description: '自动人脸/肩部裁剪', icon: Image, category: Category.FRONTEND, component: HeadshotExtractor },
  { id: 'pdf', name: 'PDF 工具箱', description: '合并 / 转图片', icon: Files, category: Category.FRONTEND, component: PdfTools },
  { id: 'faceswap', name: 'AI 换脸', description: '本地 WebGL 换脸', icon: UserRoundCog, category: Category.FRONTEND, component: FaceSwapTool },

  // --- Category 8: DevOps (DEVOPS) ---
  { id: 'chmod', name: 'Chmod 计算', description: 'Linux 权限计算', icon: Terminal, category: Category.DEVOPS, component: ChmodTool },

  // --- Category 9: Generators (GENERATORS) ---
  { id: 'uuid', name: 'UUID 生成', description: '随机 V4 UUIDs', icon: Fingerprint, category: Category.GENERATORS, component: UuidTool },
  { id: 'random-str', name: '随机字符串', description: '随机 String / NanoID', icon: Fingerprint, category: Category.GENERATORS, component: RandomStringTool },

  // --- Category 14: Custom (CUSTOM) ---
  { id: 'jewelry', name: 'AI 首饰定制', description: '文字首饰生成器', icon: Gem, category: Category.CUSTOM, component: JewelryCustomizer },
  { id: 'smart-geometry', name: '小学几何解题', description: '加载 JSON 交互讲解', icon: Ruler, category: Category.CUSTOM, component: SmartGeometryTool },

  // --- Extra: AI ---
  { id: 'ai', name: 'AI 代码助手', description: '智能编程问答', icon: Sparkles, category: Category.AI, component: AiAssistant },
];

const DEFAULT_TOOL_ID = TOOLS[0].id;
const TOOL_ROUTE_PREFIX = 'tools';
const TOOL_IDS = new Set(TOOLS.map(tool => tool.id));

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

  return candidate && TOOL_IDS.has(candidate) ? candidate : DEFAULT_TOOL_ID;
};

const getToolPath = (toolId: string) => `${getBasePath()}/${TOOL_ROUTE_PREFIX}/${encodeURIComponent(toolId)}`;

export default function App() {
  const [activeToolId, setActiveToolId] = useState<string>(() => getToolIdFromLocation());
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => window.innerWidth >= 768);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Fallback to first tool if active one not found
  const activeTool = TOOLS.find(t => t.id === activeToolId) || TOOLS[0];

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
          <div className="hidden items-center gap-2 text-xs font-medium text-slate-400 md:flex">
            <span>Workspace</span>
            <span className="h-1 w-1 rounded-full bg-slate-300" />
            <span>{new Date().getFullYear()}</span>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col p-3 md:p-5">
          <div className="tool-workspace min-h-0 flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <activeTool.component />
          </div>

          <div className="mt-3 flex-none text-center text-xs text-slate-400">
            程序员百宝箱 &copy; {new Date().getFullYear()} • 专为开发者打造的效率工具箱
          </div>
        </div>
      </main>
    </div>
  );
}
