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

export const TOOLS: ToolDef[] = [
  { id: 'data-format-studio', name: '数据格式与结构', description: 'JSON、XML、YAML、CSV、Schema 与结构化对比', icon: Braces, category: Category.DATA, component: DataFormatStudio },
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
