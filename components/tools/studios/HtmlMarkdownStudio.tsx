import React from 'react';
import { FileText, Braces } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const MarkdownTool = lazyNamed(() => import('../FormatTools'), 'MarkdownTool');
const HtmlToMarkdownTool = lazyNamed(() => import('../text'), 'HtmlToMarkdownTool');
const HtmlFormatTool = lazyNamed(() => import('../text'), 'HtmlFormatTool');

const subTools: SubTool[] = [
  { id: 'markdown', name: 'Markdown 预览', description: 'Markdown 转 HTML', icon: FileText, component: MarkdownTool },
  { id: 'html-markdown', name: 'HTML 转 Markdown', description: 'HTML 片段转 Markdown', icon: FileText, component: HtmlToMarkdownTool },
  { id: 'html-format', name: 'HTML 格式化/压缩器', description: 'HTML 美化与压缩', icon: Braces, component: HtmlFormatTool },
];

export const HtmlMarkdownStudio: React.FC = () => {
  return (
    <TabbedToolbox
      title="HTML & Markdown 极速预览器"
      description="本地 Markdown 文档即时渲染、HTML 结构美化压缩及 HTML-Markdown 智能双向转换"
      tools={subTools}
      defaultTab="markdown"
    />
  );
};
