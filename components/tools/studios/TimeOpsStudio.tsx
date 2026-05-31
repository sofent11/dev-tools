import React from 'react';
import { CalendarClock, Clock, Terminal } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const ChmodTool = lazyNamed(() => import('../DevOpsTools'), 'ChmodTool');
const CronTool = lazyNamed(() => import('../DevOpsTools'), 'CronTool');
const UnixTimeStudio = lazyNamed(() => import('../time/UnixTimeStudio'), 'UnixTimeStudio');

const subTools: SubTool[] = [
  { id: 'unix-time-studio', name: '时间与时区工作室', description: '高精度秒级/毫秒时间戳转换、多维世界时钟、Cron 执行预测与日期计算', icon: Clock, component: UnixTimeStudio },
  { id: 'cron', name: 'Cron 表达式', description: '生成 / 解析 / 预览', icon: CalendarClock, component: CronTool },
  { id: 'chmod', name: 'Chmod 计算', description: 'Linux 权限计算', icon: Terminal, component: ChmodTool },
];

export const TimeOpsStudio: React.FC = () => (
  <TabbedToolbox
    title="时间、Cron 与权限工作室"
    description="集中处理时间戳、日期时区、调度表达式和 Linux 权限这些运维日常计算"
    tools={subTools}
    defaultTab="unix-time-studio"
  />
);
