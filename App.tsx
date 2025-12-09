import React, { useState } from 'react';
import { 
  FileJson, Type, Link, Clock, Shield, Fingerprint, 
  Hash, Sparkles, LayoutGrid, Search, Menu, X, 
  CaseUpper, AlignLeft, Regex, Palette, ArrowRightLeft, 
  QrCode, Monitor, Terminal, KeyRound, Globe, Code
} from 'lucide-react';
import { Category, ToolDef } from './types';
import { JsonTool, Base64Tool, UrlTool } from './components/tools/FormatConverters';
import { JwtTool, UuidTool, HashTool, PasswordGenTool } from './components/tools/SecurityTools';
import { TimeTool } from './components/tools/TimeTool';
import { AiAssistant } from './components/tools/AiAssistant';
import { CaseConverterTool, TextStatsTool, RegexTool } from './components/tools/TextTools';
import { PxRemTool, ColorConverterTool, QrCodeTool, DeviceInfoTool } from './components/tools/WebTools';
import { ChmodTool } from './components/tools/DevOpsTools';
import { StringEscaper } from './components/tools/StringEscaper';
import { UrlParser } from './components/tools/UrlParser';
import { DiffViewer } from './components/tools/DiffViewer';

// Tool Registry
const TOOLS: ToolDef[] = [
  // Format
  { id: 'json', name: 'JSON 格式化', description: '美化与压缩', icon: FileJson, category: Category.FORMAT, component: JsonTool },
  { id: 'base64', name: 'Base64 转换', description: '编码与解码', icon: Type, category: Category.FORMAT, component: Base64Tool },
  { id: 'url', name: 'URL 编码', description: 'URL 参数转义', icon: Link, category: Category.FORMAT, component: UrlTool },
  { id: 'escape', name: '文本转义', description: 'HTML / Unicode', icon: Code, category: Category.FORMAT, component: StringEscaper },
  
  // Text
  { id: 'case', name: '大小写转换', description: '驼峰/下划线/大写', icon: CaseUpper, category: Category.TEXT, component: CaseConverterTool },
  { id: 'stats', name: '文本统计', description: '字数/行数统计', icon: AlignLeft, category: Category.TEXT, component: TextStatsTool },
  { id: 'regex', name: '正则测试', description: 'JS 正则表达式测试', icon: Regex, category: Category.TEXT, component: RegexTool },
  { id: 'diff', name: '文本对比', description: '简易行对比', icon: ArrowRightLeft, category: Category.TEXT, component: DiffViewer },

  // Frontend / Network
  { id: 'pxrem', name: 'PX/REM 转换', description: 'CSS 单位计算', icon: ArrowRightLeft, category: Category.FRONTEND, component: PxRemTool },
  { id: 'color', name: '颜色转换', description: 'Hex / RGB 互转', icon: Palette, category: Category.FRONTEND, component: ColorConverterTool },
  { id: 'qrcode', name: '二维码生成', description: '文本转二维码图片', icon: QrCode, category: Category.FRONTEND, component: QrCodeTool },
  { id: 'urlparser', name: 'URL 解析器', description: '解析 URL 结构', icon: Globe, category: Category.NETWORK, component: UrlParser },
  { id: 'device', name: '设备信息', description: '浏览器/系统参数', icon: Monitor, category: Category.NETWORK, component: DeviceInfoTool },

  // Convert
  { id: 'time', name: '时间/日期', description: '时间戳、日期计算', icon: Clock, category: Category.CONVERT, component: TimeTool },

  // Security
  { id: 'jwt', name: 'JWT 解析', description: '查看 Token 载荷', icon: Shield, category: Category.SECURITY, component: JwtTool },
  { id: 'hash', name: 'Hash 生成', description: 'SHA1, SHA256', icon: Hash, category: Category.SECURITY, component: HashTool },
  { id: 'password', name: '密码生成', description: '高强度随机密码', icon: KeyRound, category: Category.SECURITY, component: PasswordGenTool },

  // Generators / DevOps
  { id: 'uuid', name: 'UUID 生成', description: '随机 V4 UUIDs', icon: Fingerprint, category: Category.GENERATORS, component: UuidTool },
  { id: 'chmod', name: 'Chmod 计算', description: 'Linux 权限计算', icon: Terminal, category: Category.DEVOPS, component: ChmodTool },

  // AI
  { id: 'ai', name: 'AI 代码助手', description: '智能编程问答', icon: Sparkles, category: Category.AI, component: AiAssistant },
];

export default function App() {
  const [activeToolId, setActiveToolId] = useState<string>('json');
  const [search, setSearch] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const activeTool = TOOLS.find(t => t.id === activeToolId) || TOOLS[0];
  
  // Group tools by category
  const filteredTools = TOOLS.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const groupedTools = Object.values(Category).reduce((acc, cat) => {
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
