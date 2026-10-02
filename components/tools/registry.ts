import { lazy, type ComponentType } from 'react';
import {
  Braces, Code2, Database, FileArchive, Files, Globe, Image, KeyRound,
  Layers3, Palette, Sparkles, Timer,
} from 'lucide-react';
import { Category, ToolDef } from '../../types';

const lazyNamed = <T extends Record<string, unknown>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] as ComponentType<Record<string, never>> }));

const DataFormatStudio = lazyNamed(() => import('./studios/DataFormatStudio'), 'DataFormatStudio');
const SqlDatabaseStudio = lazyNamed(() => import('./studios/SqlDatabaseStudio'), 'SqlDatabaseStudio');
const TextMarkupStudio = lazyNamed(() => import('./studios/TextMarkupStudio'), 'TextMarkupStudio');
const EncodingBinaryStudio = lazyNamed(() => import('./studios/EncodingBinaryStudio'), 'EncodingBinaryStudio');
const NetworkDiagnosticsStudio = lazyNamed(() => import('./studios/NetworkDiagnosticsStudio'), 'NetworkDiagnosticsStudio');
const FrontendStyleStudio = lazyNamed(() => import('./studios/FrontendStyleStudio'), 'FrontendStyleStudio');
const FileDocumentStudio = lazyNamed(() => import('./studios/FileDocumentStudio'), 'FileDocumentStudio');
const ImageMediaStudio = lazyNamed(() => import('./studios/ImageMediaStudio'), 'ImageMediaStudio');
const SecurityKeyStudio = lazyNamed(() => import('./studios/SecurityKeyStudio'), 'SecurityKeyStudio');
const GeneratorUtilityStudio = lazyNamed(() => import('./studios/GeneratorUtilityStudio'), 'GeneratorUtilityStudio');
const TimeOpsStudio = lazyNamed(() => import('./studios/TimeOpsStudio'), 'TimeOpsStudio');
const CadGeometryStudio = lazyNamed(() => import('./studios/CadGeometryStudio'), 'CadGeometryStudio');

const RepoDependencyStudio = lazyNamed(() => import('./studios/RepoDependencyStudio'), 'RepoDependencyStudio');

export const TOOLS: ToolDef[] = [
  { id: 'data-format-studio', name: '数据格式与结构', description: 'JSON、XML、YAML、CSV、Schema 与结构化对比', icon: Braces, category: Category.DATA, component: DataFormatStudio },
  { id: 'repo-dependency-studio', name: '仓库与依赖研究', description: 'GitHub/HuggingFace 仓库盘点、依赖树和 NuGet 签名检查', icon: Globe, category: Category.NETWORK, component: RepoDependencyStudio },
  { id: 'sql-database-studio', name: 'SQL 与本地数据库', description: 'SQL 格式化与浏览器本地 SQLite WASM 沙箱', icon: Database, category: Category.DATA, component: SqlDatabaseStudio },
  { id: 'text-markup-studio', name: '文本与标记处理', description: '文本清理、正则、Diff、Markdown 与 HTML 转换', icon: Code2, category: Category.TEXT_MARKUP, component: TextMarkupStudio },
  { id: 'encoding-binary-studio', name: '编码、转义与二进制', description: 'Base64、Data URL、Hex、URL 编码与字符实体转义', icon: FileArchive, category: Category.TEXT_MARKUP, component: EncodingBinaryStudio },
  { id: 'network-diagnostics-studio', name: '接口请求与网络诊断', description: 'HTTP、WebSocket、Ping、URL、UA、IP 与设备探针', icon: Globe, category: Category.NETWORK, component: NetworkDiagnosticsStudio },
  { id: 'frontend-style-studio', name: '前端样式与组件转换', description: 'CSS 单位/颜色/效果生成与 SVG/JSX/React 转换', icon: Palette, category: Category.FRONTEND, component: FrontendStyleStudio },
  { id: 'file-document-studio', name: '文件、PDF 与 MIME', description: 'PDF、本地文件属性、文件名路径提取与 MIME 查询', icon: Files, category: Category.FILE_MEDIA, component: FileDocumentStudio },
  { id: 'image-media-studio', name: '图片、动画与视频', description: '图片处理、抠图、水印、人像裁剪、动画帧与视频解析', icon: Image, category: Category.FILE_MEDIA, component: ImageMediaStudio },
  { id: 'security-key-studio', name: '安全、令牌与密钥', description: 'JWT、Hash、HMAC、密码、证书、PGP 与国密工具', icon: KeyRound, category: Category.SECURITY, component: SecurityKeyStudio },
  { id: 'generator-utility-studio', name: '生成器与实用计算', description: 'UUID、随机数据、Mock、人民币大写与二维码生成', icon: Sparkles, category: Category.SYSTEM, component: GeneratorUtilityStudio },
  { id: 'time-ops-studio', name: '时间、Cron 与权限', description: '时间戳、世界时钟、Cron 表达式与 Chmod 权限计算', icon: Timer, category: Category.SYSTEM, component: TimeOpsStudio },
  { id: 'cad-geometry-studio', name: '3D 打印、CAD 与几何', description: '首饰定制、STL 修复、Voronoi、CSG 与几何讲解', icon: Layers3, category: Category.CAD, component: CadGeometryStudio },
];

export const TOOL_IDS = new Set(TOOLS.map(tool => tool.id));

export const LEGACY_TOOL_MAP: Record<string, { studioId: string; subToolId?: string }> = {
  'json': { studioId: 'data-format-studio', subToolId: 'json' },
  'json2ts': { studioId: 'data-format-studio', subToolId: 'json2ts' },
  'json-schema': { studioId: 'data-format-studio', subToolId: 'json-schema' },
  'xml': { studioId: 'data-format-studio', subToolId: 'xml' },
  'yaml': { studioId: 'data-format-studio', subToolId: 'yaml' },
  'csv': { studioId: 'data-format-studio', subToolId: 'csv' },
  'json-diff': { studioId: 'data-format-studio', subToolId: 'json-diff' },
  'sql-format': { studioId: 'sql-database-studio', subToolId: 'sql-format' },
  'sqlite-sandbox': { studioId: 'sql-database-studio', subToolId: 'sqlite-sandbox' },
  'jwt': { studioId: 'security-key-studio', subToolId: 'jwt' },
  'hash': { studioId: 'security-key-studio', subToolId: 'hash' },
  'hmac': { studioId: 'security-key-studio', subToolId: 'hmac' },
  'password': { studioId: 'security-key-studio', subToolId: 'password' },
  'basic-auth': { studioId: 'security-key-studio', subToolId: 'basic-auth' },
  'cert-parser': { studioId: 'security-key-studio', subToolId: 'cert-parser' },
  'asymmetric-key': { studioId: 'security-key-studio', subToolId: 'asymmetric-key' },
  'pgp-keymaster': { studioId: 'security-key-studio', subToolId: 'pgp-keymaster' },
  'sm-crypto': { studioId: 'security-key-studio', subToolId: 'sm-crypto' },
  'case': { studioId: 'text-markup-studio', subToolId: 'case' },
  'text-manip': { studioId: 'text-markup-studio', subToolId: 'text-manip' },
  'slug': { studioId: 'text-markup-studio', subToolId: 'slug' },
  'stats': { studioId: 'text-markup-studio', subToolId: 'stats' },
  'regex': { studioId: 'text-markup-studio', subToolId: 'regex' },
  'diff': { studioId: 'text-markup-studio', subToolId: 'diff' },
  'base64': { studioId: 'encoding-binary-studio', subToolId: 'base64' },
  'file-base64': { studioId: 'encoding-binary-studio', subToolId: 'file-base64' },
  'hex-viewer': { studioId: 'encoding-binary-studio', subToolId: 'hex-viewer' },
  'hex-text': { studioId: 'encoding-binary-studio', subToolId: 'hex-text' },
  'unicode-inspector': { studioId: 'encoding-binary-studio', subToolId: 'unicode-inspector' },
  'url': { studioId: 'encoding-binary-studio', subToolId: 'url' },
  'escape': { studioId: 'encoding-binary-studio', subToolId: 'escape' },
  'markdown': { studioId: 'text-markup-studio', subToolId: 'markdown' },
  'html-markdown': { studioId: 'text-markup-studio', subToolId: 'html-markdown' },
  'html-format': { studioId: 'text-markup-studio', subToolId: 'html-format' },
  'http': { studioId: 'network-diagnostics-studio', subToolId: 'http' },
  'websocket-sse': { studioId: 'network-diagnostics-studio', subToolId: 'websocket-sse' },
  'ping': { studioId: 'network-diagnostics-studio', subToolId: 'ping' },
  'urlparser': { studioId: 'network-diagnostics-studio', subToolId: 'urlparser' },
  'useragent': { studioId: 'network-diagnostics-studio', subToolId: 'useragent' },
  'ip': { studioId: 'network-diagnostics-studio', subToolId: 'ip' },
  'device': { studioId: 'network-diagnostics-studio', subToolId: 'device' },
  'pxrem': { studioId: 'frontend-style-studio', subToolId: 'pxrem' },
  'color': { studioId: 'frontend-style-studio', subToolId: 'color' },
  'css-generator': { studioId: 'frontend-style-studio', subToolId: 'css-generator' },
  'svg-css': { studioId: 'frontend-style-studio', subToolId: 'svg-css' },
  'html-jsx': { studioId: 'frontend-style-studio', subToolId: 'html-jsx' },
  'svg-react': { studioId: 'frontend-style-studio', subToolId: 'svg-react' },
  'image': { studioId: 'image-media-studio', subToolId: 'image' },
  'image-base64': { studioId: 'image-media-studio', subToolId: 'image-base64' },
  'image-colors': { studioId: 'image-media-studio', subToolId: 'image-colors' },
  'image-watermark': { studioId: 'image-media-studio', subToolId: 'image-watermark' },
  'visual-centroid': { studioId: 'image-media-studio', subToolId: 'visual-centroid' },
  'perler-beads': { studioId: 'image-media-studio', subToolId: 'perler-beads' },
  'headshot': { studioId: 'image-media-studio', subToolId: 'headshot' },
  'background-removal': { studioId: 'image-media-studio', subToolId: 'background-removal' },
  'animation-frame': { studioId: 'image-media-studio', subToolId: 'animation-frame' },
  'pdf': { studioId: 'file-document-studio', subToolId: 'pdf' },
  'file-info': { studioId: 'file-document-studio', subToolId: 'file-info' },
  'filename': { studioId: 'file-document-studio', subToolId: 'filename' },
  'mime': { studioId: 'file-document-studio', subToolId: 'mime' },
  'video-download': { studioId: 'image-media-studio', subToolId: 'video-download' },
  'svg-optimizer': { studioId: 'frontend-style-studio', subToolId: 'svg-optimizer' },
  'qrcode': { studioId: 'generator-utility-studio', subToolId: 'qrcode' },
  'arithmancy': { studioId: 'generator-utility-studio', subToolId: 'arithmancy' },
  'numerology': { studioId: 'generator-utility-studio', subToolId: 'arithmancy' },
  'number-divination': { studioId: 'generator-utility-studio', subToolId: 'arithmancy' },
  'github-repos': { studioId: 'repo-dependency-studio', subToolId: 'github-repos' },
  'github-org-research': { studioId: 'repo-dependency-studio', subToolId: 'github-org-research' },
  'repo-folder-download': { studioId: 'repo-dependency-studio', subToolId: 'repo-folder-download' },
  'nuget-deps': { studioId: 'repo-dependency-studio', subToolId: 'nuget-deps' },
  'pypi-deps': { studioId: 'repo-dependency-studio', subToolId: 'pypi-deps' },
  'rust-deps': { studioId: 'repo-dependency-studio', subToolId: 'rust-deps' },
  'nuget-signature': { studioId: 'repo-dependency-studio', subToolId: 'nuget-signature' },
  'jewelry': { studioId: 'cad-geometry-studio', subToolId: 'jewelry' },
  'stl-repair': { studioId: 'cad-geometry-studio', subToolId: 'stl-repair' },
  'stl-voronoi': { studioId: 'cad-geometry-studio', subToolId: 'stl-voronoi' },
  '3d-csg': { studioId: 'cad-geometry-studio', subToolId: '3d-csg' },
  'smart-geometry': { studioId: 'cad-geometry-studio', subToolId: 'smart-geometry' },
  'uuid': { studioId: 'generator-utility-studio', subToolId: 'uuid' },
  'random-str': { studioId: 'generator-utility-studio', subToolId: 'random-str' },
  'random-number': { studioId: 'generator-utility-studio', subToolId: 'random-number' },
  'lorem': { studioId: 'generator-utility-studio', subToolId: 'lorem' },
  'rmb-uppercase': { studioId: 'generator-utility-studio', subToolId: 'rmb-uppercase' },
  'chmod': { studioId: 'time-ops-studio', subToolId: 'chmod' },
  'cron': { studioId: 'time-ops-studio', subToolId: 'cron' },
  'unix-time-studio': { studioId: 'time-ops-studio', subToolId: 'unix-time-studio' },
  'ai': { studioId: 'generator-utility-studio', subToolId: 'lorem' },
  'timestamp': { studioId: 'time-ops-studio', subToolId: 'unix-time-studio' },
  'timestamp-plus': { studioId: 'time-ops-studio', subToolId: 'unix-time-studio' },
  'datediff': { studioId: 'time-ops-studio', subToolId: 'unix-time-studio' },
  'world-clock': { studioId: 'time-ops-studio', subToolId: 'unix-time-studio' }
};
const LEGACY_STUDIOS: Record<string, string> = {
  "json-studio": "data-format-studio",
  "crypto-studio": "security-key-studio",
  "text-studio": "text-markup-studio",
  "encoding-studio": "encoding-binary-studio",
  "html-markdown-studio": "text-markup-studio",
  "network-studio": "network-diagnostics-studio",
  "css-studio": "frontend-style-studio",
  "image-studio": "image-media-studio",
  "file-studio": "file-document-studio",
  "cad-3d-studio": "cad-geometry-studio",
  "system-ai-studio": "generator-utility-studio"
};
export const resolveToolRoute = (segment: string | undefined) => {
  if (!segment) return null;
  if (TOOL_IDS.has(segment)) return { studioId: segment, subToolId: undefined };
  if (LEGACY_STUDIOS[segment]) {
    const tab = window.location.hash.slice(1);
    const target = Object.values(LEGACY_TOOL_MAP).find(route => route.subToolId === tab);
    return { studioId: target?.studioId || LEGACY_STUDIOS[segment], subToolId: target?.subToolId };
  }
  return LEGACY_TOOL_MAP[segment] || null;
};
