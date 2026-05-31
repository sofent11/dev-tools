import React from 'react';
import { Code, Eye, FileArchive, Link, Type } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const Base64Tool = lazyNamed(() => import('../FormatConverters'), 'Base64Tool');
const FileBase64Tool = lazyNamed(() => import('../files'), 'FileBase64Tool');
const UrlTool = lazyNamed(() => import('../FormatConverters'), 'UrlTool');
const StringEscaper = lazyNamed(() => import('../StringEscaper'), 'StringEscaper');
const BinaryHexViewerTool = lazyNamed(() => import('../DataTools'), 'BinaryHexViewerTool');

const subTools: SubTool[] = [
  { id: 'base64', name: 'Base64 转换', description: '文本编码与解码', icon: Type, component: Base64Tool },
  { id: 'file-base64', name: 'Base64/文件转换器', description: '文件转 Data URL', icon: FileArchive, component: FileBase64Tool },
  { id: 'hex-viewer', name: '十六进制 Hex 查看器', description: '文件字节级分析与魔数检测', icon: Eye, component: BinaryHexViewerTool },
  { id: 'url', name: 'URL 编码', description: 'URL 参数转义', icon: Link, component: UrlTool },
  { id: 'escape', name: 'HTML/Uni 转义', description: 'HTML / Unicode', icon: Code, component: StringEscaper },
];

export const EncodingBinaryStudio: React.FC = () => (
  <TabbedToolbox
    title="编码、转义与二进制工作室"
    description="集中处理编码、Data URL、URL 转义、字符实体与二进制查看等跨文本和文件的低层表示转换"
    tools={subTools}
    defaultTab="base64"
  />
);
