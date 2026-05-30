import React, { lazy } from 'react';
import { ArrowRightLeft, Palette, Paintbrush, BadgeCent } from 'lucide-react';
import { TabbedToolbox, SubTool } from '../shared/TabbedToolbox';

const lazyNamed = <T extends Record<string, React.ElementType>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] }));

const PxRemTool = lazyNamed(() => import('../WebTools'), 'PxRemTool');
const ColorConverterTool = lazyNamed(() => import('../WebTools'), 'ColorConverterTool');
const CssGeneratorTool = lazyNamed(() => import('../frontend'), 'CssGeneratorTool');
const SvgToCssTool = lazyNamed(() => import('../frontend'), 'SvgToCssTool');
const SvgOptimizerTool = lazyNamed(() => import('../frontend'), 'SvgOptimizerTool');

const subTools: SubTool[] = [
  { id: 'pxrem', name: 'PX/REM 转换', description: 'CSS 单位计算', icon: ArrowRightLeft, component: PxRemTool },
  { id: 'color', name: '颜色转换', description: 'Hex / RGB / HSL', icon: Palette, component: ColorConverterTool },
  { id: 'css-generator', name: 'CSS 可视化生成器', description: '阴影/渐变/圆角/毛玻璃', icon: Paintbrush, component: CssGeneratorTool },
  { id: 'svg-css', name: 'SVG 转 CSS', description: 'SVG Data URL', icon: BadgeCent, component: SvgToCssTool },
  { id: 'svg-optimizer', name: 'SVG 智能压缩', description: 'SVGO 本地无损优化', icon: BadgeCent, component: SvgOptimizerTool },
];

export const CssStylingToolkit: React.FC = () => {
  return (
    <TabbedToolbox
      title="CSS & 矢量图形样式工坊"
      description="集成 PX/REM 极速转换、多格式色值调配、玻璃拟态常用特效生成、SVG 的 CSS 嵌入转换及本地 SVG 智能无损压缩比对"
      tools={subTools}
      defaultTab="pxrem"
    />
  );
};
