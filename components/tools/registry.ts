import { lazy, type ComponentType } from 'react';
import {
  FileJson, Shield, FileText, Globe, Palette, Image, Gem, Sparkles, Scissors, Binary, Files, Network
} from 'lucide-react';
import { Category, ToolDef, ToolRegistration } from '../../types';

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] as ComponentType<Record<string, never>> }));

export interface LegacyToolRoute {
  alias: string;
  studioId: string;
  subToolId: string;
  policy: 'legacy';
}

export interface ToolRouteResolution {
  studioId: string;
  subToolId?: string;
  isLegacy: boolean;
}

const withRegistration = (tool: ToolDef): ToolRegistration => ({
  ...tool,
  loadStrategy: 'lazy',
  status: 'stable',
  compatibility: {
    introducedIn: '2026-01-01',
  },
});

// Import consolidated Studios
const JsonFormatStudio = lazyNamed(() => import('./studios/JsonFormatStudio'), 'JsonFormatStudio');
const CryptoSecurityCenter = lazyNamed(() => import('./studios/CryptoSecurityCenter'), 'CryptoSecurityCenter');
const TextDiffSuite = lazyNamed(() => import('./studios/TextDiffSuite'), 'TextDiffSuite');
const EncodingEscaping = lazyNamed(() => import('./studios/EncodingEscaping'), 'EncodingEscaping');
const HtmlMarkdownStudio = lazyNamed(() => import('./studios/HtmlMarkdownStudio'), 'HtmlMarkdownStudio');
const NetworkClientInspector = lazyNamed(() => import('./studios/NetworkClientInspector'), 'NetworkClientInspector');
const RepoDependencyStudio = lazyNamed(() => import('./studios/RepoDependencyStudio'), 'RepoDependencyStudio');
const CssStylingToolkit = lazyNamed(() => import('./studios/CssStylingToolkit'), 'CssStylingToolkit');
const ImageMediaStudio = lazyNamed(() => import('./studios/ImageMediaStudio'), 'ImageMediaStudio');
const Cad3DStudio = lazyNamed(() => import('./studios/Cad3DStudio'), 'Cad3DStudio');
const SystemAiStudio = lazyNamed(() => import('./studios/SystemAiStudio'), 'SystemAiStudio');
const FileDocumentStudio = lazyNamed(() => import('./studios/FileDocumentStudio'), 'FileDocumentStudio');

const TOOLS_DEFINITIONS: ToolDef[] = [
  { id: 'json-studio', name: 'JSON & 数据格式化', description: 'JSON、XML、YAML、CSV、SQL 转换与对比', icon: FileJson, category: Category.DATA, component: JsonFormatStudio },
  { id: 'crypto-studio', name: '安全与加密中心', description: 'JWT、Hash、HMAC、证书及私钥评估', icon: Shield, category: Category.SECURITY, component: CryptoSecurityCenter },
  { id: 'text-studio', name: '文本编辑与对比', description: '大小写转换、正则测试、差分比对、字数统计', icon: Scissors, category: Category.TEXT_MARKUP, component: TextDiffSuite },
  { id: 'encoding-studio', name: '编码与字符转义', description: 'Base64、文件转换、URL 编码、转义处理', icon: Binary, category: Category.TEXT_MARKUP, component: EncodingEscaping },
  { id: 'html-markdown-studio', name: 'HTML & Markdown 预览', description: 'MD 即时渲染、双向转换与 HTML 压缩', icon: FileText, category: Category.TEXT_MARKUP, component: HtmlMarkdownStudio },
  { id: 'network-studio', name: '网络请求与探针', description: 'HTTP 客户端、URL 解析、UA、IP 与设备探针及在线视频流解析', icon: Globe, category: Category.NETWORK, component: NetworkClientInspector },
  { id: 'repo-dependency-studio', name: '仓库与依赖研究', description: 'GitHub/HuggingFace 仓库盘点、依赖树和 NuGet 签名检查', icon: Network, category: Category.NETWORK, component: RepoDependencyStudio },
  { id: 'css-studio', name: 'CSS & 矢量图形样式工坊', description: '单位换算、调色板、CSS 渐变阴影、SVG 智能无损压缩与嵌入', icon: Palette, category: Category.FRONTEND, component: CssStylingToolkit },
  { id: 'image-studio', name: '图形与图像创意工坊', description: '图片极致压缩、智能抠图、色板提取、水印、拼豆、AI 换脸及大头照提取', icon: Image, category: Category.FILE_MEDIA, component: ImageMediaStudio },
  { id: 'file-studio', name: '文件与文档处理中心', description: '本地 PDF 合并转换、文件属性哈希分析及文件名提取', icon: Files, category: Category.FILE_MEDIA, component: FileDocumentStudio },
  { id: 'cad-3d-studio', name: '3D 建模与 CAD 首饰', description: '首饰定制、STL 修复、镂空设计、小学几何', icon: Gem, category: Category.CAD, component: Cad3DStudio },
  { id: 'system-ai-studio', name: '系统、时间与智能工坊', description: 'UUID、二维码、Mock 假数、人民币大写、Chmod/Cron Linux 计算', icon: Sparkles, category: Category.SYSTEM, component: SystemAiStudio },
];

export const LEGACY_TOOL_MAP: Record<string, { studioId: string; subToolId: string }> = {
  // JSON & Format Studio
  'json': { studioId: 'json-studio', subToolId: 'json' },
  'json2ts': { studioId: 'json-studio', subToolId: 'json2ts' },
  'json-schema': { studioId: 'json-studio', subToolId: 'json-schema' },
  'xml': { studioId: 'json-studio', subToolId: 'xml' },
  'yaml': { studioId: 'json-studio', subToolId: 'yaml' },
  'csv': { studioId: 'json-studio', subToolId: 'csv' },
  'json-diff': { studioId: 'json-studio', subToolId: 'json-diff' },
  'sql-format': { studioId: 'json-studio', subToolId: 'sql-format' },
  'sqlite-sandbox': { studioId: 'json-studio', subToolId: 'sqlite-sandbox' },

  // Crypto & Security Center
  'jwt': { studioId: 'crypto-studio', subToolId: 'jwt' },
  'hash': { studioId: 'crypto-studio', subToolId: 'hash' },
  'hmac': { studioId: 'crypto-studio', subToolId: 'hmac' },
  'password': { studioId: 'crypto-studio', subToolId: 'password' },
  'basic-auth': { studioId: 'crypto-studio', subToolId: 'basic-auth' },
  'cert-parser': { studioId: 'crypto-studio', subToolId: 'cert-parser' },
  'asymmetric-key': { studioId: 'crypto-studio', subToolId: 'asymmetric-key' },
  'pgp-keymaster': { studioId: 'crypto-studio', subToolId: 'pgp-keymaster' },
  'sm-crypto': { studioId: 'crypto-studio', subToolId: 'sm-crypto' },

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
  'hex-viewer': { studioId: 'encoding-studio', subToolId: 'hex-viewer' },
  'hex-text': { studioId: 'encoding-studio', subToolId: 'hex-text' },
  'unicode-inspector': { studioId: 'encoding-studio', subToolId: 'unicode-inspector' },
  'url': { studioId: 'encoding-studio', subToolId: 'url' },
  'escape': { studioId: 'encoding-studio', subToolId: 'escape' },

  // Html & Markdown Studio
  'markdown': { studioId: 'html-markdown-studio', subToolId: 'markdown' },
  'html-markdown': { studioId: 'html-markdown-studio', subToolId: 'html-markdown' },
  'html-format': { studioId: 'html-markdown-studio', subToolId: 'html-format' },

  // Network & Client Inspector
  'http': { studioId: 'network-studio', subToolId: 'http' },
  'websocket-sse': { studioId: 'network-studio', subToolId: 'websocket-sse' },
  'ping': { studioId: 'network-studio', subToolId: 'ping' },
  'urlparser': { studioId: 'network-studio', subToolId: 'urlparser' },
  'useragent': { studioId: 'network-studio', subToolId: 'useragent' },
  'ip': { studioId: 'network-studio', subToolId: 'ip' },
  'device': { studioId: 'network-studio', subToolId: 'device' },

  // CSS & Styling Toolkit
  'pxrem': { studioId: 'css-studio', subToolId: 'pxrem' },
  'color': { studioId: 'css-studio', subToolId: 'color' },
  'css-generator': { studioId: 'css-studio', subToolId: 'css-generator' },
  'svg-css': { studioId: 'css-studio', subToolId: 'svg-css' },
  'html-jsx': { studioId: 'css-studio', subToolId: 'html-jsx' },
  'svg-react': { studioId: 'css-studio', subToolId: 'svg-react' },

  // Image & Media Studio
  'image': { studioId: 'image-studio', subToolId: 'image' },
  'image-base64': { studioId: 'image-studio', subToolId: 'image-base64' },
  'image-colors': { studioId: 'image-studio', subToolId: 'image-colors' },
  'image-watermark': { studioId: 'image-studio', subToolId: 'image-watermark' },
  'visual-centroid': { studioId: 'image-studio', subToolId: 'visual-centroid' },
  'perler-beads': { studioId: 'image-studio', subToolId: 'perler-beads' },
  'headshot': { studioId: 'image-studio', subToolId: 'headshot' },
  'background-removal': { studioId: 'image-studio', subToolId: 'background-removal' },
  'animation-frame': { studioId: 'image-studio', subToolId: 'animation-frame' },

  // File & Document Hub
  'pdf': { studioId: 'file-studio', subToolId: 'pdf' },
  'file-info': { studioId: 'file-studio', subToolId: 'file-info' },
  'filename': { studioId: 'file-studio', subToolId: 'filename' },
  'mime': { studioId: 'file-studio', subToolId: 'mime' },

  // Network & System re-mapped
  'video-download': { studioId: 'network-studio', subToolId: 'video-download' },
  'svg-optimizer': { studioId: 'css-studio', subToolId: 'svg-optimizer' },
  'qrcode': { studioId: 'system-ai-studio', subToolId: 'qrcode' },

  // Repository & Dependency Studio
  'github-repos': { studioId: 'repo-dependency-studio', subToolId: 'github-repos' },
  'github-org-research': { studioId: 'repo-dependency-studio', subToolId: 'github-org-research' },
  'repo-folder-download': { studioId: 'repo-dependency-studio', subToolId: 'repo-folder-download' },
  'nuget-deps': { studioId: 'repo-dependency-studio', subToolId: 'nuget-deps' },
  'pypi-deps': { studioId: 'repo-dependency-studio', subToolId: 'pypi-deps' },
  'rust-deps': { studioId: 'repo-dependency-studio', subToolId: 'rust-deps' },
  'nuget-signature': { studioId: 'repo-dependency-studio', subToolId: 'nuget-signature' },

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
  'unix-time-studio': { studioId: 'system-ai-studio', subToolId: 'unix-time-studio' },
  'ai': { studioId: 'system-ai-studio', subToolId: 'lorem' },
  'timestamp': { studioId: 'system-ai-studio', subToolId: 'unix-time-studio' },
  'timestamp-plus': { studioId: 'system-ai-studio', subToolId: 'unix-time-studio' },
  'datediff': { studioId: 'system-ai-studio', subToolId: 'unix-time-studio' },
  'world-clock': { studioId: 'system-ai-studio', subToolId: 'unix-time-studio' },
};

export const TOOL_IDS = new Set(TOOLS_DEFINITIONS.map(tool => tool.id));
export const TOOLS: ToolRegistration[] = TOOLS_DEFINITIONS.map(withRegistration);
export const TOOL_REGISTRY = new Map<string, ToolRegistration>(TOOLS.map(tool => [tool.id, tool]));

const LEGACY_TOOL_ROUTES = Object.entries(LEGACY_TOOL_MAP).map(([alias, route]) => ({
  alias,
  studioId: route.studioId,
  subToolId: route.subToolId,
  policy: 'legacy' as const,
}));

const LEGACY_TOOL_ROUTE_MAP = new Map<string, { studioId: string; subToolId: string }>(
  LEGACY_TOOL_ROUTES.map(({ alias, studioId, subToolId }) => [alias, { studioId, subToolId }]),
);

export const TOOL_COMPATIBILITY_ROUTES = Object.freeze(LEGACY_TOOL_ROUTES);

export const resolveToolRoute = (segment: string | null | undefined): ToolRouteResolution | null => {
  if (!segment) return null;
  if (TOOL_IDS.has(segment)) return { studioId: segment, isLegacy: false };

  const legacy = LEGACY_TOOL_ROUTE_MAP.get(segment);
  if (!legacy) return null;

  return { studioId: legacy.studioId, subToolId: legacy.subToolId, isLegacy: true };
};

export const resolveToolByAlias = (segment: string | null | undefined) => {
  if (!segment) return null;
  return LEGACY_TOOL_ROUTE_MAP.get(segment) ?? null;
};
