import React from 'react';
import { ArrowRightLeft, BadgeCent, Code, FileCode, Paintbrush, Palette } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const PxRemTool = lazyNamed(() => import('../WebTools'), 'PxRemTool');
const ColorConverterTool = lazyNamed(() => import('../WebTools'), 'ColorConverterTool');
const CssGeneratorTool = lazyNamed(() => import('../frontend'), 'CssGeneratorTool');
const SvgToCssTool = lazyNamed(() => import('../frontend'), 'SvgToCssTool');
const SvgOptimizerTool = lazyNamed(() => import('../frontend'), 'SvgOptimizerTool');
const HtmlToJsxTool = lazyNamed(() => import('../frontend'), 'HtmlToJsxTool');
const SvgToReactTool = lazyNamed(() => import('../frontend'), 'SvgToReactTool');

const subTools: SubTool[] = [
  { id: 'pxrem', name: 'PX/REM 转换', description: 'CSS 单位计算', icon: ArrowRightLeft, component: PxRemTool },
  { id: 'color', name: '颜色转换', description: 'Hex / RGB / HSL', icon: Palette, component: ColorConverterTool },
  { id: 'css-generator', name: 'CSS 可视化生成器', description: '阴影/渐变/圆角/毛玻璃', icon: Paintbrush, component: CssGeneratorTool },
  { id: 'svg-css', name: 'SVG 转 CSS', description: 'SVG Data URL', icon: BadgeCent, component: SvgToCssTool },
  { id: 'svg-optimizer', name: 'SVG 智能压缩', description: 'SVGO 本地无损优化', icon: BadgeCent, component: SvgOptimizerTool },
  { id: 'html-jsx', name: 'HTML 转 JSX', description: '原生 HTML 转 React JSX', icon: Code, component: HtmlToJsxTool },
  { id: 'svg-react', name: 'SVG 转 React', description: 'SVG 转 JSX/TSX 组件', icon: FileCode, component: SvgToReactTool },
];

export const FrontendStyleStudio: React.FC = () => (
  <TabbedToolbox
    title="前端样式与组件转换工作室"
    description="把样式计算、视觉效果生成与 SVG/HTML 到前端组件的转换放在同一个前端生产流里"
    tools={subTools}
    defaultTab="pxrem"
  />
);
