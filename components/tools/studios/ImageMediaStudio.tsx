import React, { lazy } from 'react';
import { Image, Images, Palette, LayoutTemplate, Grid3X3, Files, UserRoundCog, FileSearch, FileText, FileVideo, BadgeCent, QrCode } from 'lucide-react';
import { TabbedToolbox, SubTool } from '../shared/TabbedToolbox';

const lazyNamed = <T extends Record<string, React.ElementType>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] }));

const ImageTools = lazyNamed(() => import('../ImageTools'), 'ImageTools');
const ImageToBase64Tool = lazyNamed(() => import('../images'), 'ImageToBase64Tool');
const ImageColorExtractTool = lazyNamed(() => import('../images'), 'ImageColorExtractTool');
const ImageWatermarkTool = lazyNamed(() => import('../images'), 'ImageWatermarkTool');
const PerlerBeadTool = lazyNamed(() => import('../images'), 'PerlerBeadTool');
const HeadshotExtractor = lazyNamed(() => import('../HeadshotExtractor'), 'HeadshotExtractor');
const PdfTools = lazyNamed(() => import('../PdfTools'), 'PdfTools');
const FaceSwapTool = lazyNamed(() => import('../FaceSwapTool'), 'FaceSwapTool');
const FileInfoTool = lazyNamed(() => import('../files'), 'FileInfoTool');
const FileNameExtractorTool = lazyNamed(() => import('../files'), 'FileNameExtractorTool');
const VideoDownloader = lazyNamed(() => import('../VideoDownloader'), 'VideoDownloader');
const SvgOptimizerTool = lazyNamed(() => import('../frontend'), 'SvgOptimizerTool');
const MimeTypeTool = lazyNamed(() => import('../frontend'), 'MimeTypeTool');
const QrCodeTool = lazyNamed(() => import('../WebTools'), 'QrCodeTool');

const subTools: SubTool[] = [
  { id: 'image', name: '图片压缩/转换', description: '压缩 / 格式转换', icon: Image, component: ImageTools },
  { id: 'image-base64', name: '图片转 Base64', description: '图片 Data URL', icon: Images, component: ImageToBase64Tool },
  { id: 'image-colors', name: '图片颜色提取', description: '主色与色板', icon: Palette, component: ImageColorExtractTool },
  { id: 'image-watermark', name: '图片水印', description: 'Canvas 文字水印', icon: LayoutTemplate, component: ImageWatermarkTool },
  { id: 'perler-beads', name: '拼豆图纸生成', description: '图片转拼豆网格 (Worker 异步加速)', icon: Grid3X3, component: PerlerBeadTool },
  { id: 'headshot', name: '大头照提取', description: '自动人脸/肩部裁剪', icon: Image, component: HeadshotExtractor },
  { id: 'pdf', name: 'PDF 工具箱', description: '合并 / 转图片', icon: Files, component: PdfTools },
  { id: 'faceswap', name: 'AI 换脸', description: '本地 WebGL 换脸', icon: UserRoundCog, component: FaceSwapTool },
  { id: 'file-info', name: '文件信息', description: '大小/类型/哈希', icon: FileSearch, component: FileInfoTool },
  { id: 'filename', name: '文件名提取', description: '路径与 URL 提取', icon: FileText, component: FileNameExtractorTool },
  { id: 'video-download', name: '视频下载解析', description: '解析视频直链 / HLS / Cloudflare Workers 部署脚本', icon: FileVideo, component: VideoDownloader },
  { id: 'svg-optimizer', name: 'SVG 优化压缩', description: 'SVGO 本地压缩', icon: BadgeCent, component: SvgOptimizerTool },
  { id: 'mime', name: 'MIME 类型', description: '扩展名与 MIME 查询', icon: FileSearch, component: MimeTypeTool },
  { id: 'qrcode', name: '二维码生成', description: '文本/WiFi/名片/事件', icon: QrCode, component: QrCodeTool },
];

export const ImageMediaStudio: React.FC = () => {
  return (
    <TabbedToolbox
      title="图形与多媒体创意工坊"
      description="集成图片极致压缩、智能颜色提取、PDF 编辑、本地人脸对齐、换脸、视频流抓取的一站式多媒体中心"
      tools={subTools}
      defaultTab="image"
    />
  );
};
