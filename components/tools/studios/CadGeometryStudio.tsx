import React, { lazy } from 'react';
import { Box, Boxes, Gem, Layers, Ruler } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const JewelryCustomizer = lazy(() => import('../JewelryCustomizer'));
const StlRepairTool = lazy(() => import('../StlRepair'));
const VoronoiLatticeTool = lazy(() => import('../VoronoiLattice'));
const CsgWorkbench = lazyNamed(() => import('./CsgWorkbench'), 'CsgWorkbench');
const SmartGeometryTool = lazy(() => import('../SmartGeometry'));

const subTools: SubTool[] = [
  { id: 'jewelry', name: 'AI 首饰定制', description: '文字首饰生成器与 3D PBR 实时预览及 DXF/STL 导出', icon: Gem, component: JewelryCustomizer },
  { id: 'stl-repair', name: 'STL 修复/降面', description: '本地清理 / 降面 / 导出及 Worker 进度反馈', icon: Box, component: StlRepairTool },
  { id: 'stl-voronoi', name: 'STL 镂空/Voronoi', description: '本地蜂窝镂空 / STL 导出及深度 GPU 释放', icon: Boxes, component: VoronoiLatticeTool },
  { id: '3d-csg', name: '3D 实体布尔运算', description: '网页端 3D 实体交互式并集、差集、交集运算与 STL 导出', icon: Layers, component: CsgWorkbench },
  { id: 'smart-geometry', name: '小学几何解题', description: '加载 JSON 交互讲解', icon: Ruler, component: SmartGeometryTool },
];

export const CadGeometryStudio: React.FC = () => (
  <TabbedToolbox
    title="3D 打印、CAD 与几何工作室"
    description="面向 3D 打印、CAD 建模、首饰定制和交互几何讲解的空间计算工具集合"
    tools={subTools}
    defaultTab="jewelry"
  />
);
