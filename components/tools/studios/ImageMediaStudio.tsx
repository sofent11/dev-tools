import React, { lazy } from 'react';
import { Image, Images, Palette, LayoutTemplate, Grid3X3, Scissors, FileVideo } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const ImageTools = lazyNamed(() => import('../ImageTools'), 'ImageTools');
const BackgroundRemoval = lazyNamed(() => import('./BackgroundRemoval'), 'BackgroundRemoval');
const ImageToBase64Tool = lazyNamed(() => import('../images'), 'ImageToBase64Tool');
const ImageColorExtractTool = lazyNamed(() => import('../images'), 'ImageColorExtractTool');
const ImageWatermarkTool = lazyNamed(() => import('../images'), 'ImageWatermarkTool');
const PerlerBeadTool = lazyNamed(() => import('../images'), 'PerlerBeadTool');
const HeadshotExtractor = lazyNamed(() => import('../HeadshotExtractor'), 'HeadshotExtractor');
const AnimationFrameExtractor = lazy(() => import('../AnimationFrameExtractor').then(m => ({ default: m.AnimationFrameExtractor })));

const subTools: SubTool[] = [
  { id: 'image', name: '图片压缩/转换', description: '压缩 / 格式转换', icon: Image, component: ImageTools },
  { id: 'background-removal', name: '智能本地抠图', description: '本地高精度图片背景色去除与画笔边缘修正', icon: Scissors, component: BackgroundRemoval },
  { id: 'image-base64', name: '图片转 Base64', description: '图片 Data URL', icon: Images, component: ImageToBase64Tool },
  { id: 'image-colors', name: '图片颜色提取', description: '主色与色板', icon: Palette, component: ImageColorExtractTool },
  { id: 'image-watermark', name: '图片水印', description: 'Canvas 文字水印', icon: LayoutTemplate, component: ImageWatermarkTool },
  { id: 'perler-beads', name: '拼豆图纸生成', description: '图片转拼豆网格 (Worker 异步加速)', icon: Grid3X3, component: PerlerBeadTool },
  { id: 'headshot', name: '大头照提取', description: '自动人脸/肩部裁剪', icon: Image, component: HeadshotExtractor },
  { id: 'animation-frame', name: '动画帧提取', description: '动图与 Lottie 逐帧提取', icon: FileVideo, component: AnimationFrameExtractor },
];

export const ImageMediaStudio: React.FC = () => {
  return (
    <TabbedToolbox
      title="图形与图像创意工坊"
      description="集成图片极致压缩、智能颜色提取、本地高精度抠图、人脸裁剪与动画帧提取的一站式多媒体图形中心"
      tools={subTools}
      defaultTab="image"
    />
  );
};
