import React from 'react';
import { AlignLeft, ArrowRightLeft, Braces, CaseUpper, FileText, Link, Regex, Scissors } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const CaseConverterTool = lazyNamed(() => import('../TextTools'), 'CaseConverterTool');
const StringManipulatorTool = lazyNamed(() => import('../StringTools'), 'StringManipulatorTool');
const SlugTool = lazyNamed(() => import('../StringTools'), 'SlugTool');
const TextStatsTool = lazyNamed(() => import('../TextTools'), 'TextStatsTool');
const RegexTool = lazyNamed(() => import('../TextTools'), 'RegexTool');
const DiffViewer = lazyNamed(() => import('../DiffViewer'), 'DiffViewer');
const MarkdownTool = lazyNamed(() => import('../FormatTools'), 'MarkdownTool');
const HtmlToMarkdownTool = lazyNamed(() => import('../text'), 'HtmlToMarkdownTool');
const HtmlFormatTool = lazyNamed(() => import('../text'), 'HtmlFormatTool');

const subTools: SubTool[] = [
  { id: 'case', name: '大小写转换', description: '驼峰/下划线/大写', icon: CaseUpper, component: CaseConverterTool },
  { id: 'text-manip', name: '文本处理', description: '去重/排序/全半角', icon: Scissors, component: StringManipulatorTool },
  { id: 'slug', name: 'Slug 生成', description: '标题转 URL Slug', icon: Link, component: SlugTool },
  { id: 'stats', name: '文本统计', description: '字数/行数统计', icon: AlignLeft, component: TextStatsTool },
  { id: 'regex', name: '正则测试', description: 'JS 正则表达式测试', icon: Regex, component: RegexTool },
  { id: 'diff', name: '文本对比', description: '简易行对比与节点折叠', icon: ArrowRightLeft, component: DiffViewer },
  { id: 'markdown', name: 'Markdown 预览', description: 'Markdown 转 HTML', icon: FileText, component: MarkdownTool },
  { id: 'html-markdown', name: 'HTML 转 Markdown', description: 'HTML 片段转 Markdown', icon: FileText, component: HtmlToMarkdownTool },
  { id: 'html-format', name: 'HTML 格式化/压缩器', description: 'HTML 美化与压缩', icon: Braces, component: HtmlFormatTool },
];

export const TextMarkupStudio: React.FC = () => (
  <TabbedToolbox
    title="文本与标记处理工作室"
    description="把纯文本、正则、Diff、Markdown 与 HTML 处理放在同一条编辑任务流里，减少跨菜单跳转"
    tools={subTools}
    defaultTab="case"
  />
);
