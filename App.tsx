import React, { useState } from 'react';
import { 
  FileJson, Type, Link, Clock, Shield, Fingerprint, 
  Hash, Sparkles, LayoutGrid, Search, Menu, X, 
  CaseUpper, AlignLeft, Regex, Palette, ArrowRightLeft, 
  QrCode, Monitor, Terminal, KeyRound, Globe, Code,
  FileCode, Database, FileSpreadsheet, FileText, Scissors,
  Send, Calculator, Image, Files, Gem
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

  // --- Category 8: DevOps (DEVOPS) ---
  { id: 'chmod', name: 'Chmod 计算', description: 'Linux 权限计算', icon: Terminal, category: Category.DEVOPS, component: ChmodTool },

  // --- Category 9: Generators (GENERATORS) ---
  { id: 'uuid', name: 'UUID 生成', description: '随机 V4 UUIDs', icon: Fingerprint, category: Category.GENERATORS, component: UuidTool },
  { id: 'random-str', name: '随机字符串', description: '随机 String / NanoID', icon: Fingerprint, category: Category.GENERATORS, component: RandomStringTool },

  // --- Category 14: Custom (CUSTOM) ---
  { id: 'jewelry', name: 'AI 首饰定制', description: '文字首饰生成器', icon: Gem, category: Category.CUSTOM, component: JewelryCustomizer },

  // --- Extra: AI ---
  { id: 'ai', name: 'AI 代码助手', description: '智能编程问答', icon: Sparkles, category: Category.AI, component: AiAssistant },
];

export default function App() {
  const [activeToolId, setActiveToolId] = useState<string>('json');
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Fallback to first tool if active one not found
  const activeTool = TOOLS.find(t => t.id === activeToolId) || TOOLS[0];
  
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
    <div className="flex h-screen w-screen bg-slate-50 font-sans">
      
      {/* Mobile Menu Overlay */}
      {!isSidebarOpen && (
          <button 
            className="md:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md border border-slate-200"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
          <div className="h-16 flex-none flex items-center px-6 border-b border-slate-100">
              <div className="flex items-center gap-2 text-primary-600 font-bold text-xl tracking-tight">
                  <LayoutGrid className="w-6 h-6" /> 程序员百宝箱
              </div>
              <button 
                className="ml-auto md:hidden p-1 text-slate-400 hover:text-slate-600"
                onClick={() => setIsSidebarOpen(false)}
              >
                  <X className="w-5 h-5" />
              </button>
          </div>

          <div className="p-4 flex-none">
              <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                      type="text" 
                      placeholder="搜索工具..." 
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-300 transition-colors"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                  />
              </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
              {Object.entries(groupedTools).map(([category, tools]) => (
                  <div key={category}>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2 sticky top-0 bg-white z-10 py-1">{category}</h3>
                      <div className="space-y-1">
                          {tools.map(tool => (
                              <button
                                  key={tool.id}
                                  onClick={() => {
                                      setActiveToolId(tool.id);
                                      if (window.innerWidth < 768) setIsSidebarOpen(false);
                                  }}
                                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group
                                      ${activeToolId === tool.id 
                                          ? 'bg-primary-50 text-primary-700 shadow-sm' 
                                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                                  `}
                              >
                                  <tool.icon className={`w-5 h-5 ${activeToolId === tool.id ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                                  <div className="flex flex-col items-start text-left truncate">
                                      <span className="truncate w-full">{tool.name}</span>
                                  </div>
                              </button>
                          ))}
                      </div>
                  </div>
              ))}

              {Object.keys(groupedTools).length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm">
                      未找到相关工具
                  </div>
              )}
          </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden bg-slate-50/50 relative">
        <div className="h-full p-4 md:p-8 max-w-7xl mx-auto flex flex-col">
            <div className="flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <activeTool.component />
            </div>
            
            <div className="mt-4 text-center text-xs text-slate-400">
                程序员百宝箱 &copy; {new Date().getFullYear()} • 专为开发者打造的效率工具箱
            </div>
        </div>
      </main>
    </div>
  );
}
