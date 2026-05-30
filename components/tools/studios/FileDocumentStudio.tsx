import React from 'react';
import { Files, FileSearch, FileText } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const PdfTools = lazyNamed(() => import('../PdfTools'), 'PdfTools');
const FileInfoTool = lazyNamed(() => import('../files'), 'FileInfoTool');
const FileNameExtractorTool = lazyNamed(() => import('../files'), 'FileNameExtractorTool');
const MimeTypeTool = lazyNamed(() => import('../frontend'), 'MimeTypeTool');

const subTools: SubTool[] = [
  { id: 'pdf', name: 'PDF 工具箱', description: '合并 / 转图片', icon: Files, component: PdfTools },
  { id: 'file-info', name: '文件属性信息', description: '大小/类型/哈希检测', icon: FileSearch, component: FileInfoTool },
  { id: 'filename', name: '文件名路径提取', description: '从路径与 URL 中快速提取', icon: FileText, component: FileNameExtractorTool },
  { id: 'mime', name: 'MIME 类型速查', description: '扩展名与 MIME 查询', icon: FileSearch, component: MimeTypeTool },
];

export const FileDocumentStudio: React.FC = () => {
  return (
    <TabbedToolbox
      title="文件与文档处理中心"
      description="提供高安全的本地 PDF 合并转换、文件多维元属性与哈希检测，以及 MIME 速查工具"
      tools={subTools}
      defaultTab="pdf"
    />
  );
};
