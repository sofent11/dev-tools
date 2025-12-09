import { LucideIcon } from 'lucide-react';

export enum Category {
  FORMAT = '格式化',
  CONVERT = '转换工具',
  TEXT = '文本处理',
  FRONTEND = '前端开发',
  SECURITY = '安全 & 加密',
  DEVOPS = '运维 & 系统',
  GENERATORS = '生成器',
  NETWORK = '网络 & 设备',
  AI = 'AI 助手'
}

export interface ToolDef {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: Category;
  component: React.FC;
}

export type Tab = 'input' | 'output';