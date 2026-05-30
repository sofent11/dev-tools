import React from 'react';
import { Type, FileArchive, Link, Code } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const Base64Tool = lazyNamed(() => import('../FormatConverters'), 'Base64Tool');
const FileBase64Tool = lazyNamed(() => import('../files'), 'FileBase64Tool');
const UrlTool = lazyNamed(() => import('../FormatConverters'), 'UrlTool');
const StringEscaper = lazyNamed(() => import('../StringEscaper'), 'StringEscaper');

const subTools: SubTool[] = [
  { id: 'base64', name: 'Base64 转换', description: '文本编码与解码', icon: Type, component: Base64Tool },
  { id: 'file-base64', name: 'Base64/文件转换器', description: '文件转 Data URL', icon: FileArchive, component: FileBase64Tool },
  { id: 'url', name: 'URL 编码', description: 'URL 参数转义', icon: Link, component: UrlTool },
  { id: 'escape', name: 'HTML/Uni 转义', description: 'HTML / Unicode', icon: Code, component: StringEscaper },
];

export const EncodingEscaping: React.FC = () => {
  return (
    <TabbedToolbox
      title="编码与数据转义工作室"
      description="极速进行 Base64 编解码、文件 Data URL 互转、URL 参数转义和 HTML/Unicode 字符实体处理"
      tools={subTools}
      defaultTab="base64"
    />
  );
};
