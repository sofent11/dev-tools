import React from 'react';
import { Binary, Fingerprint, QrCode, WalletCards, Wand2 } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const UuidTool = lazyNamed(() => import('../SecurityTools'), 'UuidTool');
const RandomStringTool = lazyNamed(() => import('../StringTools'), 'RandomStringTool');
const RandomNumberTool = lazyNamed(() => import('../generators'), 'RandomNumberTool');
const LoremIpsumTool = lazyNamed(() => import('../generators'), 'LoremIpsumTool');
const RmbUppercaseTool = lazyNamed(() => import('../text'), 'RmbUppercaseTool');
const QrCodeTool = lazyNamed(() => import('../WebTools'), 'QrCodeTool');

const subTools: SubTool[] = [
  { id: 'uuid', name: 'UUID 生成', description: '随机 V4 UUIDs', icon: Fingerprint, component: UuidTool },
  { id: 'random-str', name: '随机字符串', description: '随机 String / NanoID', icon: Fingerprint, component: RandomStringTool },
  { id: 'random-number', name: '随机数生成器', description: '范围随机整数', icon: Binary, component: RandomNumberTool },
  { id: 'lorem', name: '占位与 Mock 数据', description: '中英文假文及高级 JSON 结构 API 模拟数据', icon: Wand2, component: LoremIpsumTool },
  { id: 'rmb-uppercase', name: '人民币大写', description: '金额转中文大写', icon: WalletCards, component: RmbUppercaseTool },
  { id: 'qrcode', name: '二维码生成', description: '文本/WiFi/名片生成器', icon: QrCode, component: QrCodeTool },
];

export const GeneratorUtilityStudio: React.FC = () => (
  <TabbedToolbox
    title="生成器与实用计算工作室"
    description="把随机标识、Mock 数据、占位文本、金额表达和二维码这些轻量生成任务集中管理"
    tools={subTools}
    defaultTab="uuid"
  />
);
