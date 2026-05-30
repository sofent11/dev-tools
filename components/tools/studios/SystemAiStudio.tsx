import React, { lazy } from 'react';
import { Fingerprint, Binary, Wand2, WalletCards, Terminal, CalendarClock, Clock, QrCode } from 'lucide-react';
import { TabbedToolbox, SubTool } from '../shared/TabbedToolbox';

const lazyNamed = <T extends Record<string, React.ElementType>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] }));

const UuidTool = lazyNamed(() => import('../SecurityTools'), 'UuidTool');
const RandomStringTool = lazyNamed(() => import('../StringTools'), 'RandomStringTool');
const RandomNumberTool = lazyNamed(() => import('../generators'), 'RandomNumberTool');
const LoremIpsumTool = lazyNamed(() => import('../generators'), 'LoremIpsumTool');
const RmbUppercaseTool = lazyNamed(() => import('../text'), 'RmbUppercaseTool');
const ChmodTool = lazyNamed(() => import('../DevOpsTools'), 'ChmodTool');
const CronTool = lazyNamed(() => import('../DevOpsTools'), 'CronTool');
const UnixTimeStudio = lazyNamed(() => import('../time/UnixTimeStudio'), 'UnixTimeStudio');
const QrCodeTool = lazyNamed(() => import('../WebTools'), 'QrCodeTool');

const subTools: SubTool[] = [
  { id: 'uuid', name: 'UUID 生成', description: '随机 V4 UUIDs', icon: Fingerprint, component: UuidTool },
  { id: 'random-str', name: '随机字符串', description: '随机 String / NanoID', icon: Fingerprint, component: RandomStringTool },
  { id: 'random-number', name: '随机数生成器', description: '范围随机整数', icon: Binary, component: RandomNumberTool },
  { id: 'lorem', name: '占位与 Mock 数据', description: '中英文假文及高级 JSON 结构 API 模拟数据', icon: Wand2, component: LoremIpsumTool },
  { id: 'rmb-uppercase', name: '人民币大写', description: '金额转中文大写', icon: WalletCards, component: RmbUppercaseTool },
  { id: 'chmod', name: 'Chmod 计算', description: 'Linux 权限计算', icon: Terminal, component: ChmodTool },
  { id: 'cron', name: 'Cron 表达式', description: '生成 / 解析 / 预览', icon: CalendarClock, component: CronTool },
  { id: 'unix-time-studio', name: '时间与时区工作室', description: '高精度秒级/毫秒时间戳转换、多维世界时钟、Cron 执行预测与日期计算', icon: Clock, component: UnixTimeStudio },
  { id: 'qrcode', name: '二维码生成', description: '文本/WiFi/名片生成器', icon: QrCode, component: QrCodeTool },
];

export const SystemAiStudio: React.FC = () => {
  return (
    <TabbedToolbox
      title="系统计算、数据生成与时间工坊"
      description="集成高级随机数/UUID/API Mock 数据生成、二维码配置、Cron/Chmod Linux 工具及世界多维时区换算"
      tools={subTools}
      defaultTab="uuid"
    />
  );
};
