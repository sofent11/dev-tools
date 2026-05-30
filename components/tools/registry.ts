import { lazy, type ElementType } from 'react';
import {
  FileJson, Shield, FileText, Globe, Palette, Image, Gem, Sparkles, Scissors, Binary, Files
} from 'lucide-react';
import { Category, ToolDef } from '../../types';

const lazyNamed = <T extends Record<string, ElementType>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] }));

// Import consolidated Studios
const JsonFormatStudio = lazyNamed(() => import('./studios/JsonFormatStudio'), 'JsonFormatStudio');
const CryptoSecurityCenter = lazyNamed(() => import('./studios/CryptoSecurityCenter'), 'CryptoSecurityCenter');
const TextDiffSuite = lazyNamed(() => import('./studios/TextDiffSuite'), 'TextDiffSuite');
const EncodingEscaping = lazyNamed(() => import('./studios/EncodingEscaping'), 'EncodingEscaping');
const HtmlMarkdownStudio = lazyNamed(() => import('./studios/HtmlMarkdownStudio'), 'HtmlMarkdownStudio');
const NetworkClientInspector = lazyNamed(() => import('./studios/NetworkClientInspector'), 'NetworkClientInspector');
const CssStylingToolkit = lazyNamed(() => import('./studios/CssStylingToolkit'), 'CssStylingToolkit');
const ImageMediaStudio = lazyNamed(() => import('./studios/ImageMediaStudio'), 'ImageMediaStudio');
const Cad3DStudio = lazyNamed(() => import('./studios/Cad3DStudio'), 'Cad3DStudio');
const SystemAiStudio = lazyNamed(() => import('./studios/SystemAiStudio'), 'SystemAiStudio');
const FileDocumentStudio = lazyNamed(() => import('./studios/FileDocumentStudio'), 'FileDocumentStudio');

export const TOOLS: ToolDef[] = [
  { id: 'json-studio', name: 'JSON & 数据格式化', description: 'JSON、XML、YAML、CSV、SQL 转换与对比', icon: FileJson, category: Category.DEV, component: JsonFormatStudio },
  { id: 'crypto-studio', name: '安全与加密中心', description: 'JWT、Hash、HMAC、证书及私钥评估', icon: Shield, category: Category.SECURITY, component: CryptoSecurityCenter },
  { id: 'text-studio', name: '文本编辑与对比', description: '大小写转换、正则测试、差分比对、字数统计', icon: Scissors, category: Category.TEXT, component: TextDiffSuite },
  { id: 'encoding-studio', name: '编码与字符转义', description: 'Base64、文件转换、URL 编码、转义处理', icon: Binary, category: Category.TEXT, component: EncodingEscaping },
  { id: 'html-markdown-studio', name: 'HTML & Markdown 预览', description: 'MD 即时渲染、双向转换与 HTML 压缩', icon: FileText, category: Category.TEXT, component: HtmlMarkdownStudio },
  { id: 'network-studio', name: '网络请求与探针', description: 'HTTP 客户端、URL 解析、UA、IP 与设备探针及在线视频流解析', icon: Globe, category: Category.NETWORK, component: NetworkClientInspector },
  { id: 'css-studio', name: 'CSS & 矢量图形样式工坊', description: '单位换算、调色板、CSS 渐变阴影、SVG 智能无损压缩与嵌入', icon: Palette, category: Category.MEDIA, component: CssStylingToolkit },
  { id: 'image-studio', name: '图形与图像创意工坊', description: '图片极致压缩、智能抠图、色板提取、水印、拼豆、AI 换脸及大头照提取', icon: Image, category: Category.MEDIA, component: ImageMediaStudio },
  { id: 'file-studio', name: '文件与文档处理中心', description: '本地 PDF 合并转换、文件属性哈希分析及文件名提取', icon: Files, category: Category.MEDIA, component: FileDocumentStudio },
  { id: 'cad-3d-studio', name: '3D 建模与 CAD 首饰', description: '首饰定制、STL 修复、镂空设计、小学几何', icon: Gem, category: Category.MEDIA, component: Cad3DStudio },
  { id: 'system-ai-studio', name: '系统、时间与智能工坊', description: 'UUID、二维码、Mock 假数、人民币大写、Chmod/Cron Linux 计算', icon: Sparkles, category: Category.SMART_AI, component: SystemAiStudio },
];

export const TOOL_IDS = new Set(TOOLS.map(tool => tool.id));

export const LEGACY_TOOL_MAP: Record<string, { studioId: string; subToolId: string }> = {
  // JSON & Format Studio
  'json': { studioId: 'json-studio', subToolId: 'json' },
  'json2ts': { studioId: 'json-studio', subToolId: 'json2ts' },
  'xml': { studioId: 'json-studio', subToolId: 'xml' },
  'yaml': { studioId: 'json-studio', subToolId: 'yaml' },
  'csv': { studioId: 'json-studio', subToolId: 'csv' },
  'json-diff': { studioId: 'json-studio', subToolId: 'json-diff' },
  'sql-format': { studioId: 'json-studio', subToolId: 'sql-format' },

  // Crypto & Security Center
  'jwt': { studioId: 'crypto-studio', subToolId: 'jwt' },
  'hash': { studioId: 'crypto-studio', subToolId: 'hash' },
  'hmac': { studioId: 'crypto-studio', subToolId: 'hmac' },
  'password': { studioId: 'crypto-studio', subToolId: 'password' },
  'basic-auth': { studioId: 'crypto-studio', subToolId: 'basic-auth' },
  'cert-parser': { studioId: 'crypto-studio', subToolId: 'cert-parser' },
  'asymmetric-key': { studioId: 'crypto-studio', subToolId: 'asymmetric-key' },

  // Text & Diff Suite
  'case': { studioId: 'text-studio', subToolId: 'case' },
  'text-manip': { studioId: 'text-studio', subToolId: 'text-manip' },
  'slug': { studioId: 'text-studio', subToolId: 'slug' },
  'stats': { studioId: 'text-studio', subToolId: 'stats' },
  'regex': { studioId: 'text-studio', subToolId: 'regex' },
  'diff': { studioId: 'text-studio', subToolId: 'diff' },

  // Encoding & Escaping
  'base64': { studioId: 'encoding-studio', subToolId: 'base64' },
  'file-base64': { studioId: 'encoding-studio', subToolId: 'file-base64' },
  'url': { studioId: 'encoding-studio', subToolId: 'url' },
  'escape': { studioId: 'encoding-studio', subToolId: 'escape' },

  // Html & Markdown Studio
  'markdown': { studioId: 'html-markdown-studio', subToolId: 'markdown' },
  'html-markdown': { studioId: 'html-markdown-studio', subToolId: 'html-markdown' },
  'html-format': { studioId: 'html-markdown-studio', subToolId: 'html-format' },

  // Network & Client Inspector
  'http': { studioId: 'network-studio', subToolId: 'http' },
  'urlparser': { studioId: 'network-studio', subToolId: 'urlparser' },
  'useragent': { studioId: 'network-studio', subToolId: 'useragent' },
  'ip': { studioId: 'network-studio', subToolId: 'ip' },
  'device': { studioId: 'network-studio', subToolId: 'device' },

  // CSS & Styling Toolkit
  'pxrem': { studioId: 'css-studio', subToolId: 'pxrem' },
  'color': { studioId: 'css-studio', subToolId: 'color' },
  'css-generator': { studioId: 'css-studio', subToolId: 'css-generator' },
  'svg-css': { studioId: 'css-studio', subToolId: 'svg-css' },

  // Image & Media Studio
  'image': { studioId: 'image-studio', subToolId: 'image' },
  'image-base64': { studioId: 'image-studio', subToolId: 'image-base64' },
  'image-colors': { studioId: 'image-studio', subToolId: 'image-colors' },
  'image-watermark': { studioId: 'image-studio', subToolId: 'image-watermark' },
  'perler-beads': { studioId: 'image-studio', subToolId: 'perler-beads' },
  'headshot': { studioId: 'image-studio', subToolId: 'headshot' },
  'faceswap': { studioId: 'image-studio', subToolId: 'faceswap' },
  'background-removal': { studioId: 'image-studio', subToolId: 'background-removal' },

  // File & Document Hub
  'pdf': { studioId: 'file-studio', subToolId: 'pdf' },
  'file-info': { studioId: 'file-studio', subToolId: 'file-info' },
  'filename': { studioId: 'file-studio', subToolId: 'filename' },
  'mime': { studioId: 'file-studio', subToolId: 'mime' },

  // Network & System re-mapped
  'video-download': { studioId: 'network-studio', subToolId: 'video-download' },
  'svg-optimizer': { studioId: 'css-studio', subToolId: 'svg-optimizer' },
  'qrcode': { studioId: 'system-ai-studio', subToolId: 'qrcode' },

  // 3D & CAD Studio
  'jewelry': { studioId: 'cad-3d-studio', subToolId: 'jewelry' },
  'stl-repair': { studioId: 'cad-3d-studio', subToolId: 'stl-repair' },
  'stl-voronoi': { studioId: 'cad-3d-studio', subToolId: 'stl-voronoi' },
  '3d-csg': { studioId: 'cad-3d-studio', subToolId: '3d-csg' },
  'smart-geometry': { studioId: 'cad-3d-studio', subToolId: 'smart-geometry' },

  // System, Generators & AI
  'uuid': { studioId: 'system-ai-studio', subToolId: 'uuid' },
  'random-str': { studioId: 'system-ai-studio', subToolId: 'random-str' },
  'random-number': { studioId: 'system-ai-studio', subToolId: 'random-number' },
  'lorem': { studioId: 'system-ai-studio', subToolId: 'lorem' },
  'rmb-uppercase': { studioId: 'system-ai-studio', subToolId: 'rmb-uppercase' },
  'chmod': { studioId: 'system-ai-studio', subToolId: 'chmod' },
  'cron': { studioId: 'system-ai-studio', subToolId: 'cron' },
  'ai': { studioId: 'system-ai-studio', subToolId: 'ai' },
  'timestamp': { studioId: 'system-ai-studio', subToolId: 'timestamp' },
  'timestamp-plus': { studioId: 'system-ai-studio', subToolId: 'timestamp-plus' },
  'datediff': { studioId: 'system-ai-studio', subToolId: 'datediff' },
  'world-clock': { studioId: 'system-ai-studio', subToolId: 'world-clock' },
};
