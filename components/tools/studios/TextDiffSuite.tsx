import React from 'react';
import { CaseUpper, Scissors, Link, AlignLeft, Regex, ArrowRightLeft } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const CaseConverterTool = lazyNamed(() => import('../TextTools'), 'CaseConverterTool');
const StringManipulatorTool = lazyNamed(() => import('../StringTools'), 'StringManipulatorTool');
const SlugTool = lazyNamed(() => import('../StringTools'), 'SlugTool');
const TextStatsTool = lazyNamed(() => import('../TextTools'), 'TextStatsTool');
const RegexTool = lazyNamed(() => import('../TextTools'), 'RegexTool');
const DiffViewer = lazyNamed(() => import('../DiffViewer'), 'DiffViewer');

const subTools: SubTool[] = [
  { id: 'case', name: '大小写转换', description: '驼峰/下划线/大写', icon: CaseUpper, component: CaseConverterTool },
  { id: 'text-manip', name: '文本处理', description: '去重/排序/全半角', icon: Scissors, component: StringManipulatorTool },
  { id: 'slug', name: 'Slug 生成', description: '标题转 URL Slug', icon: Link, component: SlugTool },
  { id: 'stats', name: '文本统计', description: '字数/行数统计', icon: AlignLeft, component: TextStatsTool },
  { id: 'regex', name: '正则测试', description: 'JS 正则表达式测试', icon: Regex, component: RegexTool },
  { id: 'diff', name: '文本对比', description: '简易行对比与节点折叠', icon: ArrowRightLeft, component: DiffViewer },
];

export const TextDiffSuite: React.FC = () => {
  return (
    <TabbedToolbox
      title="文本编辑与 Diff 套件"
      description="涵盖文本大小写转换、正则测试、比对、排版去重及字数统计的高效文本实验室"
      tools={subTools}
      defaultTab="case"
    />
  );
};
