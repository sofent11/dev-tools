import React, { lazy } from 'react';
import { Gem, Box, Boxes, Ruler } from 'lucide-react';
import { TabbedToolbox, SubTool } from '../shared/TabbedToolbox';

const lazyDefault = <T extends { default: React.ElementType }>(loader: () => Promise<T>) =>
  lazy(async () => ({ default: (await loader()).default }));

const JewelryCustomizer = lazyDefault(() => import('../JewelryCustomizer'));
const StlRepairTool = lazyDefault(() => import('../StlRepair'));
const VoronoiLatticeTool = lazyDefault(() => import('../VoronoiLattice'));
const SmartGeometryTool = lazyDefault(() => import('../SmartGeometry'));

const subTools: SubTool[] = [
  { id: 'jewelry', name: 'AI 首饰定制', description: '文字首饰生成器与 3D PBR 实时预览及 DXF/STL 导出', icon: Gem, component: JewelryCustomizer },
  { id: 'stl-repair', name: 'STL 修复/降面', description: '本地清理 / 降面 / 导出及 Worker 进度反馈', icon: Box, component: StlRepairTool },
  { id: 'stl-voronoi', name: 'STL 镂空/Voronoi', description: '本地蜂窝镂空 / STL 导出及深度 GPU 释放', icon: Boxes, component: VoronoiLatticeTool },
  { id: 'smart-geometry', name: '小学几何解题', description: '加载 JSON 交互讲解', icon: Ruler, component: SmartGeometryTool },
];

export const Cad3DStudio: React.FC = () => {
  return (
    <TabbedToolbox
      title="3D 建模与 CAD 设计创意工坊"
      description="集成 3D 打印级 STL 文件本地降面修复、蜂窝状镂空造型设计、首饰个性化三维定制及 2D DXF 矢量导出的一站式 3D 空间计算实验室"
      tools={subTools}
      defaultTab="jewelry"
    />
  );
};
