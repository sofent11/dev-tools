import { LucideIcon } from 'lucide-react';

export enum Category {
  TEXT = '编码 / 文本',       // 1. 编码 / 文本处理类
  TIME = '时间 / 日期',       // 2. 时间 / 日期类
  NETWORK = '网络 / Web',     // 3. 网络 / HTTP / Web 类
  SECURITY = '加密 / 安全',   // 4. 加密 / 安全 / 哈希类
  CODE = '代码 / 语言',       // 5. 代码 / 语言相关工具
  DATA = '数据 / 数据库',     // 6. 数据格式 / 数据库相关工具
  FRONTEND = '前端 / UI',     // 7. 前端 / UI / 图片相关工具
  DEVOPS = '日志 / 运维',     // 8. 日志 / 调试 / 运维小工具
  GENERATORS = '随机 / 生成', // 9. 随机 / 生成数据类
  I18N = '国际化 / 文案',     // 10. 国际化 / 文案辅助工具
  API = '接口 / 文档',        // 11. 前后端接口 / 文档相关
  COLLAB = '团队 / 协作',     // 12. 团队协作 / 杂项工具
  TEST = '测试 / QA',         // 13. 测试 / QA 相关工具
  CUSTOM = '定制工具',        // 14. 定制小工具
  AI = 'AI 助手'              // Extra
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
