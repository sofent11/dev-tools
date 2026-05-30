import React from 'react';
import { LucideIcon } from 'lucide-react';

export enum Category {
  TEXT = '文本与编码',
  DEV = '开发与数据',
  NETWORK = '网络与运维',
  SECURITY = '安全与生成',
  MEDIA = '图形与媒体',
  SMART_AI = '时间与智能'
}

export interface ToolDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: Category;
  component: React.ElementType;
}

export type Tab = 'input' | 'output';
