export type Locale = 'zh-CN' | 'en-US';

export const LOCALES: { code: Locale; label: string; shortLabel: string }[] = [
  { code: 'zh-CN', label: '简体中文', shortLabel: '中' },
  { code: 'en-US', label: 'English', shortLabel: 'EN' },
];

export const DEFAULT_LOCALE: Locale = 'zh-CN';

const enExact: Record<string, string> = {
  '程序员百宝箱': 'Dev Toolbox',
  '个开发效率工具': 'developer tools',
  '搜索工具...': 'Search tools...',
  '未找到相关工具': 'No matching tools found',
  '打开工具目录': 'Open tool catalog',
  '关闭工具目录': 'Close tool catalog',
  '关闭工具目录遮罩': 'Close tool catalog overlay',
  '打开全局数据暂存箱': 'Open global scratchpad',
  '关闭全局数据暂存箱': 'Close global scratchpad',
  '切换到浅色模式': 'Switch to light mode',
  '切换到深色模式': 'Switch to dark mode',
  '正在加载': 'Loading',
  '专为开发者打造的效率工具箱': 'Productivity tools built for developers',
  '全局数据暂存箱': 'Global Scratchpad',
  '临时保存文本/代码，打通所有 Studio': 'Temporarily save text and code across all studios',
  '常规模式': 'Normal mode',
  '开启打包多选': 'Select multiple for ZIP',
  '取消': 'Cancel',
  '全选': 'Select all',
  '暂存箱暂无内容': 'The scratchpad is empty',
  '您可以在 Mock数据、图片转换 等工具中直接点击“送入暂存箱”将数据保存到此处。': 'Use “Send to scratchpad” in tools such as mock data or image conversion to save data here.',
  '清空暂存箱': 'Clear scratchpad',
  '字符': 'chars',
  'SVG 矢量图': 'SVG vector',
  '复制': 'Copy',
  '下载': 'Download',
  '删除': 'Delete',
  '打包 ZIP 失败': 'Failed to package ZIP',

  '文本与编码': 'Text & Encoding',
  '开发与数据': 'Development & Data',
  '网络与运维': 'Network & Ops',
  '安全与生成': 'Security & Generators',
  '图形与媒体': 'Graphics & Media',
  '时间与智能': 'Time & Intelligence',

  'JSON & 数据格式化': 'JSON & Data Formatting',
  'JSON、XML、YAML、CSV、SQL 转换与对比': 'JSON, XML, YAML, CSV, and SQL conversion and comparison',
  '安全与加密中心': 'Security & Cryptography Center',
  'JWT、Hash、HMAC、证书及私钥评估': 'JWT, hash, HMAC, certificates, and private-key assessment',
  '文本编辑与对比': 'Text Editing & Diff',
  '大小写转换、正则测试、差分比对、字数统计': 'Case conversion, regex testing, diffing, and text statistics',
  '编码与字符转义': 'Encoding & Escaping',
  'Base64、文件转换、URL 编码、转义处理': 'Base64, file conversion, URL encoding, and escaping',
  'HTML & Markdown 预览': 'HTML & Markdown Preview',
  'MD 即时渲染、双向转换与 HTML 压缩': 'Live Markdown rendering, two-way conversion, and HTML minification',
  '网络请求与探针': 'Network Requests & Probes',
  'HTTP 客户端、URL 解析、UA、IP 与设备探针及在线视频流解析': 'HTTP client, URL parsing, UA, IP/device probes, and online video stream parsing',
  'CSS & 矢量图形样式工坊': 'CSS & Vector Styling Workshop',
  '单位换算、调色板、CSS 渐变阴影、SVG 智能无损压缩与嵌入': 'Unit conversion, palettes, CSS gradients/shadows, and SVG optimization/embedding',
  '图形与图像创意工坊': 'Graphics & Image Workshop',
  '图片极致压缩、智能抠图、色板提取、水印、拼豆、AI 换脸及大头照提取': 'Image compression, cutout, palette extraction, watermarking, bead art, AI face swap, and headshot extraction',
  '文件与文档处理中心': 'File & Document Center',
  '本地 PDF 合并转换、文件属性哈希分析及文件名提取': 'Local PDF merging/conversion, file hash analysis, and filename extraction',
  '3D 建模与 CAD 首饰': '3D Modeling & CAD Jewelry',
  '首饰定制、STL 修复、镂空设计、小学几何': 'Jewelry customization, STL repair, lattice design, and geometry tools',
  '系统、时间与智能工坊': 'System, Time & Intelligence Workshop',
  'UUID、二维码、Mock 假数、人民币大写、Chmod/Cron Linux 计算': 'UUIDs, QR codes, mock data, RMB uppercase, chmod, cron, and Linux calculators',

  'JSON 格式化': 'JSON Formatter',
  '美化与压缩': 'Beautify and minify',
  'JSON 转代码': 'JSON to Code',
  '转 TS/Go/Java/Pydantic/SQL': 'Generate TS, Go, Java, Pydantic, or SQL',
  'JSON Schema': 'JSON Schema',
  '生成与校验 JSON Schema 规范': 'Generate and validate JSON Schema',
  'XML 工具': 'XML Tools',
  '格式化 / JSON 转换': 'Format and convert to JSON',
  'YAML ↔ JSON': 'YAML ↔ JSON',
  'YAML / JSON 互转': 'Convert YAML and JSON',
  'CSV ↔ JSON': 'CSV ↔ JSON',
  'CSV / JSON 互转': 'Convert CSV and JSON',
  'JSON 结构化对比': 'Structured JSON Diff',
  '树状增删改对比': 'Tree-based add/remove/change comparison',
  'SQL 格式化': 'SQL Formatter',
  '方言格式化 / 压缩': 'Dialect formatting and minification',
  'SQLite WASM 沙箱': 'SQLite WASM Sandbox',
  '离线 SQLite 数据库': 'Offline SQLite database',
  'JSON & 数据格式化工作室': 'JSON & Data Formatting Studio',
  '集成 JSON 格式化、转换、Diff、常用数据库格式化以及离线 SQLite WebAssembly 数据库沙箱的一站式数据处理中心': 'An all-in-one data workspace for JSON formatting, conversion, diffing, SQL formatting, and an offline SQLite WebAssembly sandbox',
  '安全与加密中心工作室': 'Security & Cryptography Center',
  '文本编辑与对比工作室': 'Text Editing & Diff Studio',
  '编码与字符转义工作室': 'Encoding & Escaping Studio',
  'HTML & Markdown 预览工作室': 'HTML & Markdown Preview Studio',
  '网络请求与探针工作室': 'Network Requests & Probes Studio',
  'CSS & 矢量图形样式工坊工作室': 'CSS & Vector Styling Workshop',
  '图形与图像创意工坊工作室': 'Graphics & Image Workshop',
  '文件与文档处理中心工作室': 'File & Document Center',
  '3D 建模与 CAD 首饰工作室': '3D Modeling & CAD Jewelry Studio',
  '系统、时间与智能工坊工作室': 'System, Time & Intelligence Workshop',

  '当前工具': 'Current tool',
  '正在加载工具组件': 'Loading tool component',
  '未加载工具组件': 'Tool component not loaded',
};

const enPhraseReplacements: Array<[RegExp, string]> = [
  [/JSON & 数据格式化工作室/g, 'JSON & Data Formatting Studio'],
  [/集成 JSON 格式化、转换、Diff、常用数据库格式化以及离线 SQLite WebAssembly 数据库沙箱的一站式数据处理中心/g, 'An all-in-one data workspace for JSON formatting, conversion, diffing, SQL formatting, and an offline SQLite WebAssembly sandbox'],
  [/安全与加密中心工作室/g, 'Security & Cryptography Center'],
  [/文本编辑与对比工作室/g, 'Text Editing & Diff Studio'],
  [/编码与字符转义工作室/g, 'Encoding & Escaping Studio'],
  [/HTML & Markdown 预览工作室/g, 'HTML & Markdown Preview Studio'],
  [/网络请求与探针工作室/g, 'Network Requests & Probes Studio'],
  [/CSS & 矢量图形样式工坊工作室/g, 'CSS & Vector Styling Workshop'],
  [/图形与图像创意工坊工作室/g, 'Graphics & Image Workshop'],
  [/文件与文档处理中心工作室/g, 'File & Document Center'],
  [/3D 建模与 CAD 首饰工作室/g, '3D Modeling & CAD Jewelry Studio'],
  [/系统、时间与智能工坊工作室/g, 'System, Time & Intelligence Workshop'],
  [/当前工具/g, 'Current tool'],
  [/(\d+)\s*个开发效率工具/g, '$1 developer tools'],
  [/正在加载\s*(.+?)\.\.\./g, 'Loading $1...'],
  [/(.+?)\s*-\s*程序员百宝箱/g, '$1 - Dev Toolbox'],
  [/(\d+)\s*字符/g, '$1 chars'],
  [/第\s*(\d+)\s*次/g, 'Run $1'],
  [/已复制/g, 'Copied'],
  [/复制结果/g, 'Copy result'],
  [/复制签名/g, 'Copy signature'],
  [/生成数据/g, 'Generate data'],
  [/导出文件/g, 'Export file'],
  [/一键复制/g, 'Copy'],
  [/运行结果/g, 'Result'],
  [/输入文本/g, 'Input text'],
  [/输出结果/g, 'Output'],
  [/上传/g, 'Upload'],
  [/导入/g, 'Import'],
  [/导出/g, 'Export'],
  [/生成/g, 'Generate'],
  [/执行/g, 'Run'],
  [/验证/g, 'Verify'],
  [/加密/g, 'Encrypt'],
  [/解密/g, 'Decrypt'],
  [/签名/g, 'Sign'],
  [/清空/g, 'Clear'],
  [/搜索/g, 'Search'],
  [/保存/g, 'Save'],
  [/下载/g, 'Download'],
  [/复制/g, 'Copy'],
  [/删除/g, 'Delete'],
  [/刷新/g, 'Refresh'],
  [/关闭/g, 'Close'],
  [/打开/g, 'Open'],
  [/预览/g, 'Preview'],
  [/设置/g, 'Settings'],
  [/数量/g, 'Count'],
  [/类型/g, 'Type'],
  [/名称/g, 'Name'],
  [/描述/g, 'Description'],
  [/工具/g, 'Tool'],
  [/数据/g, 'Data'],
  [/文本/g, 'Text'],
  [/文件/g, 'File'],
  [/图片/g, 'Image'],
  [/密码/g, 'Password'],
  [/密钥/g, 'Key'],
  [/公钥/g, 'Public key'],
  [/私钥/g, 'Private key'],
  [/错误/g, 'Error'],
  [/失败/g, 'failed'],
  [/成功/g, 'succeeded'],
  [/暂无/g, 'No'],
];

const reverseExact = Object.fromEntries(
  Object.entries(enExact).map(([zh, en]) => [en, zh]),
) as Record<string, string>;

const hasHan = (value: string) => /[\p{Script=Han}]/u.test(value);

const preserveOuterWhitespace = (source: string, translated: string) => {
  const leading = source.match(/^\s*/)?.[0] ?? '';
  const trailing = source.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
};

export const translateText = (value: string, locale: Locale): string => {
  if (!value) return value;
  const compact = value.trim().replace(/\s+/g, ' ');

  if (locale === 'zh-CN') {
    return reverseExact[compact] ? preserveOuterWhitespace(value, reverseExact[compact]) : value;
  }

  if (!hasHan(value)) return value;
  const exact = enExact[value] ?? enExact[compact];
  if (exact) return preserveOuterWhitespace(value, exact);

  let translated = value;
  for (const [pattern, replacement] of enPhraseReplacements) {
    translated = translated.replace(pattern, replacement);
  }
  return translated;
};

export const getLocalizedLocaleName = (locale: Locale, displayLocale: Locale) => {
  if (displayLocale === 'zh-CN') {
    return locale === 'zh-CN' ? '简体中文' : 'English';
  }
  return locale === 'zh-CN' ? 'Simplified Chinese' : 'English';
};
