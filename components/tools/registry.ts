import { lazy, type ElementType } from 'react';
import {
  AlignLeft, ArrowRightLeft, BadgeCent, Binary, Braces, CalendarClock, CaseUpper, Clock,
  Box, Code, Database, FileArchive, FileCode, FileJson, FileSearch, FileSpreadsheet, FileText,
  Files, Fingerprint, Gem, Globe, Hash, Image, Images, KeyRound, LayoutTemplate, Link,
  Monitor, Palette, QrCode, Regex, Ruler, Scissors, Send, Shield, Sparkles, Terminal,
  Type, UserRoundCog, WalletCards,
} from 'lucide-react';
import { Category, ToolDef } from '../../types';

const lazyNamed = <T extends Record<string, ElementType>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] }));

const lazyDefault = <T extends { default: ElementType }>(loader: () => Promise<T>) =>
  lazy(async () => ({ default: (await loader()).default }));

const JsonTool = lazyNamed(() => import('./FormatConverters'), 'JsonTool');
const Base64Tool = lazyNamed(() => import('./FormatConverters'), 'Base64Tool');
const UrlTool = lazyNamed(() => import('./FormatConverters'), 'UrlTool');
const JwtTool = lazyNamed(() => import('./SecurityTools'), 'JwtTool');
const UuidTool = lazyNamed(() => import('./SecurityTools'), 'UuidTool');
const HashTool = lazyNamed(() => import('./SecurityTools'), 'HashTool');
const PasswordGenTool = lazyNamed(() => import('./SecurityTools'), 'PasswordGenTool');
const HmacTool = lazyNamed(() => import('./SecurityTools'), 'HmacTool');
const AiAssistant = lazyNamed(() => import('./AiAssistant'), 'AiAssistant');
const CaseConverterTool = lazyNamed(() => import('./TextTools'), 'CaseConverterTool');
const TextStatsTool = lazyNamed(() => import('./TextTools'), 'TextStatsTool');
const RegexTool = lazyNamed(() => import('./TextTools'), 'RegexTool');
const PxRemTool = lazyNamed(() => import('./WebTools'), 'PxRemTool');
const ColorConverterTool = lazyNamed(() => import('./WebTools'), 'ColorConverterTool');
const QrCodeTool = lazyNamed(() => import('./WebTools'), 'QrCodeTool');
const DeviceInfoTool = lazyNamed(() => import('./WebTools'), 'DeviceInfoTool');
const ChmodTool = lazyNamed(() => import('./DevOpsTools'), 'ChmodTool');
const StringEscaper = lazyNamed(() => import('./StringEscaper'), 'StringEscaper');
const UrlParser = lazyNamed(() => import('./UrlParser'), 'UrlParser');
const DiffViewer = lazyNamed(() => import('./DiffViewer'), 'DiffViewer');
const XmlTool = lazyNamed(() => import('./FormatTools'), 'XmlTool');
const YamlTool = lazyNamed(() => import('./FormatTools'), 'YamlTool');
const CsvTool = lazyNamed(() => import('./FormatTools'), 'CsvTool');
const MarkdownTool = lazyNamed(() => import('./FormatTools'), 'MarkdownTool');
const StringManipulatorTool = lazyNamed(() => import('./StringTools'), 'StringManipulatorTool');
const SlugTool = lazyNamed(() => import('./StringTools'), 'SlugTool');
const RandomStringTool = lazyNamed(() => import('./StringTools'), 'RandomStringTool');
const TimestampTool = lazyNamed(() => import('./TimeTools'), 'TimestampTool');
const DateDiffTool = lazyNamed(() => import('./TimeTools'), 'DateDiffTool');
const HttpBuilderTool = lazyNamed(() => import('./NetworkTools'), 'HttpBuilderTool');
const UserAgentTool = lazyNamed(() => import('./NetworkTools'), 'UserAgentTool');
const IpInfoTool = lazyNamed(() => import('./NetworkTools'), 'IpInfoTool');
const JsonToTsTool = lazyNamed(() => import('./JsonToTsTool'), 'JsonToTsTool');
const ImageTools = lazyNamed(() => import('./ImageTools'), 'ImageTools');
const HeadshotExtractor = lazyNamed(() => import('./HeadshotExtractor'), 'HeadshotExtractor');
const PdfTools = lazyNamed(() => import('./PdfTools'), 'PdfTools');
const JewelryCustomizer = lazyDefault(() => import('./JewelryCustomizer'));
const FaceSwapTool = lazyNamed(() => import('./FaceSwapTool'), 'FaceSwapTool');
const SmartGeometryTool = lazyDefault(() => import('./SmartGeometry'));
const StlRepairTool = lazyDefault(() => import('./StlRepair'));
const HtmlToMarkdownTool = lazyNamed(() => import('./text'), 'HtmlToMarkdownTool');
const HtmlFormatTool = lazyNamed(() => import('./text'), 'HtmlFormatTool');
const RmbUppercaseTool = lazyNamed(() => import('./text'), 'RmbUppercaseTool');
const TimestampPlusTool = lazyNamed(() => import('./time'), 'TimestampPlusTool');
const WorldClockTool = lazyNamed(() => import('./time'), 'WorldClockTool');
const FileBase64Tool = lazyNamed(() => import('./files'), 'FileBase64Tool');
const FileInfoTool = lazyNamed(() => import('./files'), 'FileInfoTool');
const FileNameExtractorTool = lazyNamed(() => import('./files'), 'FileNameExtractorTool');
const ImageColorExtractTool = lazyNamed(() => import('./images'), 'ImageColorExtractTool');
const ImageToBase64Tool = lazyNamed(() => import('./images'), 'ImageToBase64Tool');
const ImageWatermarkTool = lazyNamed(() => import('./images'), 'ImageWatermarkTool');
const MimeTypeTool = lazyNamed(() => import('./frontend'), 'MimeTypeTool');
const SvgToCssTool = lazyNamed(() => import('./frontend'), 'SvgToCssTool');
const BasicAuthTool = lazyNamed(() => import('./security'), 'BasicAuthTool');
const CertificateParserTool = lazyNamed(() => import('./security'), 'CertificateParserTool');
const RandomNumberTool = lazyNamed(() => import('./generators'), 'RandomNumberTool');

export const TOOLS: ToolDef[] = [
  { id: 'json', name: 'JSON 格式化', description: '美化与压缩', icon: FileJson, category: Category.TEXT, component: JsonTool },
  { id: 'json2ts', name: 'JSON 转代码', description: '转 TS/Go/Java', icon: Code, category: Category.TEXT, component: JsonToTsTool },
  { id: 'xml', name: 'XML 工具', description: '格式化 / JSON 转换', icon: FileCode, category: Category.TEXT, component: XmlTool },
  { id: 'yaml', name: 'YAML ↔ JSON', description: 'YAML / JSON 互转', icon: Database, category: Category.TEXT, component: YamlTool },
  { id: 'csv', name: 'CSV ↔ JSON', description: 'CSV / JSON 互转', icon: FileSpreadsheet, category: Category.TEXT, component: CsvTool },
  { id: 'base64', name: 'Base64 转换', description: '文本编码与解码', icon: Type, category: Category.TEXT, component: Base64Tool },
  { id: 'file-base64', name: 'Base64/文件转换器', description: '文件转 Data URL', icon: FileArchive, category: Category.TEXT, component: FileBase64Tool },
  { id: 'url', name: 'URL 编码', description: 'URL 参数转义', icon: Link, category: Category.TEXT, component: UrlTool },
  { id: 'escape', name: 'HTML/Uni 转义', description: 'HTML / Unicode', icon: Code, category: Category.TEXT, component: StringEscaper },
  { id: 'html-markdown', name: 'HTML 转 Markdown', description: 'HTML 片段转 Markdown', icon: FileText, category: Category.TEXT, component: HtmlToMarkdownTool },
  { id: 'html-format', name: 'HTML 格式化/压缩器', description: 'HTML 美化与压缩', icon: Braces, category: Category.TEXT, component: HtmlFormatTool },
  { id: 'markdown', name: 'Markdown 预览', description: 'Markdown 转 HTML', icon: FileText, category: Category.TEXT, component: MarkdownTool },
  { id: 'case', name: '大小写转换', description: '驼峰/下划线/大写', icon: CaseUpper, category: Category.TEXT, component: CaseConverterTool },
  { id: 'text-manip', name: '文本处理', description: '去重/排序/全半角', icon: Scissors, category: Category.TEXT, component: StringManipulatorTool },
  { id: 'slug', name: 'Slug 生成', description: '标题转 URL Slug', icon: Link, category: Category.TEXT, component: SlugTool },
  { id: 'stats', name: '文本统计', description: '字数/行数统计', icon: AlignLeft, category: Category.TEXT, component: TextStatsTool },
  { id: 'regex', name: '正则测试', description: 'JS 正则表达式测试', icon: Regex, category: Category.TEXT, component: RegexTool },
  { id: 'diff', name: '文本对比', description: '简易行对比', icon: ArrowRightLeft, category: Category.TEXT, component: DiffViewer },

  { id: 'timestamp', name: '时间戳转换', description: 'Unix 时间戳互转', icon: Clock, category: Category.TIME, component: TimestampTool },
  { id: 'timestamp-plus', name: '时间戳增强转换', description: '秒/毫秒/时区/ISO', icon: CalendarClock, category: Category.TIME, component: TimestampPlusTool },
  { id: 'datediff', name: '日期计算', description: '日期差值计算', icon: CalendarClock, category: Category.TIME, component: DateDiffTool },
  { id: 'world-clock', name: '世界时间', description: '常用时区时间', icon: Globe, category: Category.TIME, component: WorldClockTool },

  { id: 'http', name: 'HTTP 请求', description: '简易 HTTP Client', icon: Send, category: Category.NETWORK, component: HttpBuilderTool },
  { id: 'urlparser', name: 'URL 解析器', description: '解析 URL 结构', icon: Globe, category: Category.NETWORK, component: UrlParser },
  { id: 'useragent', name: 'User Agent', description: 'UA 解析', icon: Monitor, category: Category.NETWORK, component: UserAgentTool },
  { id: 'ip', name: 'IP 信息', description: '本机 IP 查询', icon: Globe, category: Category.NETWORK, component: IpInfoTool },
  { id: 'device', name: '设备信息', description: '浏览器/系统参数', icon: Monitor, category: Category.NETWORK, component: DeviceInfoTool },

  { id: 'jwt', name: 'JWT 解析', description: '载荷与时间声明', icon: Shield, category: Category.SECURITY, component: JwtTool },
  { id: 'hash', name: 'Hash 生成', description: 'SHA1, SHA256, SHA512', icon: Hash, category: Category.SECURITY, component: HashTool },
  { id: 'hmac', name: 'HMAC 计算', description: 'HMAC-SHA256 计算', icon: Shield, category: Category.SECURITY, component: HmacTool },
  { id: 'password', name: '密码生成', description: '高强度随机密码', icon: KeyRound, category: Category.SECURITY, component: PasswordGenTool },
  { id: 'basic-auth', name: 'Basic Auth 生成器', description: 'Authorization Header', icon: KeyRound, category: Category.SECURITY, component: BasicAuthTool },
  { id: 'cert-parser', name: '证书文本解析器', description: 'PEM 文本解析', icon: Shield, category: Category.SECURITY, component: CertificateParserTool },

  { id: 'pxrem', name: 'PX/REM 转换', description: 'CSS 单位计算', icon: ArrowRightLeft, category: Category.FRONTEND, component: PxRemTool },
  { id: 'color', name: '颜色转换', description: 'Hex / RGB / HSL', icon: Palette, category: Category.FRONTEND, component: ColorConverterTool },
  { id: 'mime', name: 'MIME 类型', description: '扩展名与 MIME 查询', icon: FileSearch, category: Category.FRONTEND, component: MimeTypeTool },
  { id: 'svg-css', name: 'SVG 转 CSS', description: 'SVG Data URL', icon: BadgeCent, category: Category.FRONTEND, component: SvgToCssTool },
  { id: 'qrcode', name: '二维码生成', description: '文本/WiFi/名片/事件', icon: QrCode, category: Category.FRONTEND, component: QrCodeTool },
  { id: 'image', name: '图片压缩/转换', description: '压缩 / 格式转换', icon: Image, category: Category.FRONTEND, component: ImageTools },
  { id: 'image-base64', name: '图片转 Base64', description: '图片 Data URL', icon: Images, category: Category.FRONTEND, component: ImageToBase64Tool },
  { id: 'image-colors', name: '图片颜色提取', description: '主色与色板', icon: Palette, category: Category.FRONTEND, component: ImageColorExtractTool },
  { id: 'image-watermark', name: '图片水印', description: 'Canvas 文字水印', icon: LayoutTemplate, category: Category.FRONTEND, component: ImageWatermarkTool },
  { id: 'headshot', name: '大头照提取', description: '自动人脸/肩部裁剪', icon: Image, category: Category.FRONTEND, component: HeadshotExtractor },
  { id: 'pdf', name: 'PDF 工具箱', description: '合并 / 转图片', icon: Files, category: Category.FRONTEND, component: PdfTools },
  { id: 'faceswap', name: 'AI 换脸', description: '本地 WebGL 换脸', icon: UserRoundCog, category: Category.FRONTEND, component: FaceSwapTool },

  { id: 'file-info', name: '文件信息', description: '大小/类型/哈希', icon: FileSearch, category: Category.DATA, component: FileInfoTool },
  { id: 'filename', name: '文件名提取', description: '路径与 URL 提取', icon: FileText, category: Category.DATA, component: FileNameExtractorTool },

  { id: 'chmod', name: 'Chmod 计算', description: 'Linux 权限计算', icon: Terminal, category: Category.DEVOPS, component: ChmodTool },

  { id: 'uuid', name: 'UUID 生成', description: '随机 V4 UUIDs', icon: Fingerprint, category: Category.GENERATORS, component: UuidTool },
  { id: 'random-str', name: '随机字符串', description: '随机 String / NanoID', icon: Fingerprint, category: Category.GENERATORS, component: RandomStringTool },
  { id: 'random-number', name: '随机数生成器', description: '范围随机整数', icon: Binary, category: Category.GENERATORS, component: RandomNumberTool },

  { id: 'rmb-uppercase', name: '人民币大写', description: '金额转中文大写', icon: WalletCards, category: Category.I18N, component: RmbUppercaseTool },

  { id: 'jewelry', name: 'AI 首饰定制', description: '文字首饰生成器', icon: Gem, category: Category.CUSTOM, component: JewelryCustomizer },
  { id: 'stl-repair', name: 'STL 修复/降面', description: '本地清理 / 降面 / 导出', icon: Box, category: Category.CUSTOM, component: StlRepairTool },
  { id: 'smart-geometry', name: '小学几何解题', description: '加载 JSON 交互讲解', icon: Ruler, category: Category.CUSTOM, component: SmartGeometryTool },

  { id: 'ai', name: 'AI 代码助手', description: '智能编程问答', icon: Sparkles, category: Category.AI, component: AiAssistant },
];

export const TOOL_IDS = new Set(TOOLS.map(tool => tool.id));
