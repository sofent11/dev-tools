import React from 'react';
import { LucideIcon } from 'lucide-react';

export enum Category {
  DATA = '数据与数据库',
  TEXT_MARKUP = '文本、标记与编码',
  NETWORK = '接口与网络',
  FRONTEND = '前端与样式',
  FILE_MEDIA = '文件与媒体',
  SECURITY = '安全与密钥',
  SYSTEM = '系统与生成器',
  CAD = '3D、CAD 与几何'
}

export interface ToolDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: Category;
  component: React.ElementType;
}

export interface ToolRegistration extends ToolDef {
  loadStrategy?: 'eager' | 'lazy' | 'background';
  status?: 'stable' | 'beta' | 'deprecated';
  compatibility?: {
    introducedIn?: string;
    compatibilityNote?: string;
  };
}

export type Tab = 'input' | 'output';
