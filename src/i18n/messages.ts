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
  '图片极致压缩、智能抠图、色板提取、水印、拼豆及大头照提取': 'Image compression, cutout, palette extraction, watermarking, bead art, and headshot extraction',
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

  '加密与安全防护中心': 'Cryptography & Security Center',
  '提供本地安全哈希、JWT 调试、强密码生成、PGP/GPG 离线密钥加解密及 RSA 私钥/证书分析的一站式安全工具箱': 'A security toolbox for local hashing, JWT debugging, strong password generation, offline PGP/GPG key encryption, and RSA private-key/certificate analysis',
  'JWT 解析': 'JWT Inspector',
  '载荷与时间声明': 'Claims and time fields',
  'Hash 生成': 'Hash Generator',
  'HMAC 计算': 'HMAC Calculator',
  'HMAC-SHA256 计算': 'HMAC-SHA256 calculation',
  '密码生成': 'Password Generator',
  '高强度随机密码与强度审计': 'Strong random passwords and strength audit',
  'Basic Auth 生成器': 'Basic Auth Generator',
  '证书密码解析器': 'Certificate & Key Parser',
  'PEM 证书与私钥强度评估与一致性配对': 'PEM certificate/private-key strength and matching checks',
  '非对称密钥转换': 'Asymmetric Key Converter',
  'PEM / JWK / DER 互转与私钥体检': 'PEM, JWK, and DER conversion with private-key audit',
  'GPG / PGP 密钥中心': 'GPG / PGP Key Center',
  '离线 GPG 密钥对生成与加解密': 'Offline GPG key generation and encryption/decryption',
  '国密算法套件 (SM2/3/4)': 'Chinese SM Suite (SM2/3/4)',
  '中国商用国密离线加密/签名/哈希套件': 'Offline Chinese commercial cryptography suite for encryption, signing, and hashing',
  '国密算法安全测试中心 (Chinese Cryptography GB/T Standard)': 'Chinese Cryptography Test Center (GB/T Standard)',
  '支持中国国家商用密码套件：SM2 椭圆曲线非对称密钥对与签名体检验、SM3 杂凑算法特征码比对及 SM4 分组对称加密（ECB/CBC 模式）的 100% 本地离线处理。': '100% local processing for Chinese commercial cryptography: SM2 elliptic-curve keypairs, encryption and signing, SM3 hashing, and SM4 block encryption in ECB/CBC modes.',
  '正在从安全 CDN 离线载入国密 SM 算法动力包，请稍候...': 'Loading the SM cryptography package from the secure CDN...',
  'SM2 非对称与签名': 'SM2 Asymmetric & Signing',
  'SM3 杂凑计算': 'SM3 Hashing',
  'SM4 对称分组加密': 'SM4 Block Encryption',

  '文本编辑与 Diff 套件': 'Text Editing & Diff Suite',
  '涵盖文本大小写转换、正则测试、比对、排版去重及字数统计的高效文本实验室': 'A text lab for case conversion, regex testing, diffing, cleanup, deduplication, and text statistics',
  '大小写转换': 'Case Conversion',
  '驼峰/下划线/大写': 'camelCase, snake_case, and uppercase',
  '文本处理': 'Text Processing',
  '去重/排序/全半角': 'Deduplicate, sort, and full/half-width conversion',
  'Slug 生成': 'Slug Generator',
  '标题转 URL Slug': 'Title to URL slug',
  '文本统计': 'Text Statistics',
  '字数/行数统计': 'Word and line counts',
  '正则测试': 'Regex Tester',
  'JS 正则表达式测试': 'JavaScript regex testing',
  '文本对比': 'Text Diff',
  '简易行对比与节点折叠': 'Line diff with collapsible nodes',

  '编码与数据转义工作室': 'Encoding & Escaping Studio',
  '极速进行 Base64 编解码、文件 Data URL 互转、URL 参数转义和 HTML/Unicode 字符实体处理': 'Fast Base64 encode/decode, file Data URL conversion, URL escaping, and HTML/Unicode entity handling',
  'Base64 转换': 'Base64 Converter',
  '文本编码与解码': 'Text encoding and decoding',
  'Base64/文件转换器': 'Base64 / File Converter',
  '文件转 Data URL': 'File to Data URL',
  '十六进制 Hex 查看器': 'Hex Viewer',
  '文件字节级分析与魔数检测': 'Byte-level file analysis and magic-number detection',
  'URL 编码': 'URL Encoder',
  'URL 参数转义': 'URL parameter escaping',
  'HTML/Uni 转义': 'HTML / Unicode Escaping',

  'HTML & Markdown 极速预览器': 'HTML & Markdown Fast Preview',
  '本地 Markdown 文档即时渲染、HTML 结构美化压缩及 HTML-Markdown 智能双向转换': 'Local Markdown rendering, HTML formatting/minification, and smart HTML-Markdown conversion',
  'Markdown 预览': 'Markdown Preview',
  'Markdown 转 HTML': 'Markdown to HTML',
  'Markdown 转 HTML 实时预览': 'Live Markdown to HTML preview',
  '实时预览': 'Live preview',
  'HTML 转 Markdown': 'HTML to Markdown',
  'HTML 片段转 Markdown': 'HTML snippet to Markdown',
  'HTML 格式化/压缩器': 'HTML Formatter / Minifier',
  'HTML 美化与压缩': 'HTML formatting and minification',

  '网络请求与客户端探针': 'Network Requests & Client Probes',
  '包含在线 HTTP 简易客户端、URL 分解、IP 与 User-Agent 解析、当前浏览器参数测定及在线视频流嗅探提取': 'HTTP client, URL decomposition, IP/User-Agent parsing, browser parameter detection, and online video stream extraction',
  'HTTP 请求': 'HTTP Request',
  '简易 HTTP Client': 'Simple HTTP Client',
  'WebSocket & SSE 沙箱': 'WebSocket & SSE Sandbox',
  '实时双向长连接调试': 'Realtime long-connection debugging',
  'Ping 延迟诊断': 'Ping Latency Diagnostics',
  '本地网络时延与抖动探针': 'Local latency and jitter probe',
  'URL 解析器': 'URL Parser',
  '解析 URL 结构': 'Parse URL structure',
  'UA 解析': 'UA parsing',
  'IP 信息': 'IP Info',
  '本机 IP 查询': 'Local IP lookup',
  '设备信息': 'Device Info',
  '浏览器/系统参数': 'Browser and system parameters',
  '视频下载解析': 'Video Download Parser',
  '解析视频直链 / HLS 视频流': 'Parse direct video links and HLS streams',

  'PX/REM 转换': 'PX / REM Converter',
  'CSS 单位计算': 'CSS unit calculation',
  '集成 PX/REM 极速转换、多格式色值调配、玻璃拟态常用特效生成、SVG 的 CSS 嵌入转换、本地 SVG 智能无损压缩及 React 组件一键生成': 'A CSS workspace for fast PX/REM conversion, multi-format color tuning, glassmorphism effects, SVG CSS embedding, local SVG optimization, and one-click React component generation',
  '颜色转换': 'Color Converter',
  'CSS 可视化生成器': 'Visual CSS Generator',
  '阴影/渐变/圆角/毛玻璃': 'Shadows, gradients, radius, and glassmorphism',
  'SVG 转 CSS': 'SVG to CSS',
  'SVG 智能压缩': 'Smart SVG Optimization',
  'SVGO 本地无损优化': 'Local lossless SVGO optimization',
  'HTML 转 JSX': 'HTML to JSX',
  '原生 HTML 转 React JSX': 'Native HTML to React JSX',
  'SVG 转 React': 'SVG to React',
  'SVG 转 JSX/TSX 组件': 'SVG to JSX/TSX component',

  '图片压缩/转换': 'Image Compression / Conversion',
  '压缩 / 格式转换': 'Compression and format conversion',
  '集成图片极致压缩、智能颜色提取、本地高精度抠图、人脸裁剪与动画帧提取的一站式多媒体图形中心': 'A multimedia workspace for image compression, smart color extraction, local background removal, face cropping, and animation frame extraction',
  '智能本地抠图': 'Smart Local Background Removal',
  '本地高精度图片背景色去除与画笔边缘修正': 'Local high-precision background removal with brush edge refinement',
  '图片转 Base64': 'Image to Base64',
  '图片 Data URL': 'Image Data URL',
  '图片颜色提取': 'Image Color Extraction',
  '主色与色板': 'Dominant colors and palette',
  '图片水印': 'Image Watermark',
  'Canvas 文字水印': 'Canvas text watermark',
  '拼豆图纸生成': 'Perler Bead Pattern Generator',
  '图片转拼豆网格 (Worker 异步加速)': 'Image to bead grid with worker acceleration',
  '大头照提取': 'Headshot Extraction',
  '自动人脸/肩部裁剪': 'Automatic face and shoulder crop',
  '动画帧提取': 'Animation Frame Extraction',
  '动图与 Lottie 逐帧提取': 'Frame-by-frame extraction for GIFs and Lottie',

  'PDF 工具箱': 'PDF Toolbox',
  '合并 / 转图片': 'Merge and convert to images',
  '提供高安全的本地 PDF 合并转换、文件多维元属性与哈希检测，以及 MIME 速查工具': 'Secure local PDF merging/conversion, file metadata and hash inspection, and MIME lookup tools',
  '文件属性信息': 'File Properties',
  '大小/类型/哈希检测': 'Size, type, and hash detection',
  '文件名路径提取': 'Filename & Path Extractor',
  '从路径与 URL 中快速提取': 'Extract quickly from paths and URLs',
  'MIME 类型速查': 'MIME Type Lookup',
  '扩展名与 MIME 查询': 'Extension and MIME lookup',

  '3D 建模与 CAD 设计创意工坊': '3D Modeling & CAD Design Workshop',
  '集成 3D 打印级 STL 文件本地降面修复、蜂窝状镂空造型设计、首饰个性化三维定制及 2D DXF 矢量导出的一站式 3D 空间计算实验室': 'A 3D workspace for local STL reduction/repair, lattice design, personalized jewelry modeling, and 2D DXF export',
  'AI 首饰定制': 'AI Jewelry Customizer',
  '文字首饰生成器与 3D PBR 实时预览及 DXF/STL 导出': 'Text jewelry generator with realtime 3D PBR preview and DXF/STL export',
  'STL 修复/降面': 'STL Repair / Decimation',
  '本地清理 / 降面 / 导出及 Worker 进度反馈': 'Local cleanup, decimation, export, and worker progress',
  'STL 镂空/Voronoi': 'STL Lattice / Voronoi',
  '本地蜂窝镂空 / STL 导出及深度 GPU 释放': 'Local lattice generation, STL export, and GPU cleanup',
  '3D 实体布尔运算': '3D Solid Boolean Operations',
  '网页端 3D 实体交互式并集、差集、交集运算与 STL 导出': 'Interactive browser-based 3D union, subtract, intersect, and STL export',
  '小学几何解题': 'Elementary Geometry Solver',
  '加载 JSON 交互讲解': 'Load JSON interactive explanations',

  '系统计算、数据生成与时间工坊': 'System Calculation, Data Generation & Time Workshop',
  '集成高级随机数/UUID/API Mock 数据生成、二维码配置、Cron/Chmod Linux 工具及世界多维时区换算': 'Advanced random/UUID/API mock data generation, QR configuration, Cron/Chmod tools, and world time conversion',
  'UUID 生成': 'UUID Generator',
  '随机 V4 UUIDs': 'Random V4 UUIDs',
  '随机字符串': 'Random String',
  '随机 String / NanoID': 'Random strings and NanoID',
  '随机数生成器': 'Random Number Generator',
  '范围随机整数': 'Random integers in a range',
  '占位与 Mock 数据': 'Placeholder & Mock Data',
  '中英文假文及高级 JSON 结构 API 模拟数据': 'Chinese/English placeholder text and advanced JSON API mock data',
  '人民币大写': 'RMB Uppercase',
  '金额转中文大写': 'Amount to Chinese uppercase',
  'Chmod 计算': 'Chmod Calculator',
  'Linux 权限计算': 'Linux permission calculation',
  'Cron 表达式': 'Cron Expression',
  '生成 / 解析 / 预览': 'Generate, parse, and preview',
  '时间与时区工作室': 'Time & Timezone Studio',
  '高精度秒级/毫秒时间戳转换、多维世界时钟、Cron 执行预测与日期计算': 'High-precision second/millisecond timestamps, world clocks, Cron predictions, and date calculations',
  '二维码生成': 'QR Code Generator',
  '文本/WiFi/名片生成器': 'Text, Wi-Fi, and vCard generator',
};

const enStructuralReplacements: Array<[RegExp, string]> = [
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
];

const enUiTermReplacements: Array<[RegExp, string]> = [
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
  let matchedKnownUiPhrase = false;
  for (const [source, replacement] of Object.entries(enExact).sort((a, b) => b[0].length - a[0].length)) {
    if (translated.includes(source)) {
      translated = translated.split(source).join(replacement);
      matchedKnownUiPhrase = true;
    }
  }
  for (const [pattern, replacement] of enStructuralReplacements) {
    const next = translated.replace(pattern, replacement);
    if (next !== translated) matchedKnownUiPhrase = true;
    translated = next;
  }
  if (!matchedKnownUiPhrase) return value;

  for (const [pattern, replacement] of enUiTermReplacements) {
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
