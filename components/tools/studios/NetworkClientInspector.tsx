import React, { lazy } from 'react';
import { Send, Globe, Monitor } from 'lucide-react';
import { TabbedToolbox, SubTool } from '../shared/TabbedToolbox';

const lazyNamed = <T extends Record<string, React.ElementType>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K,
) => lazy(async () => ({ default: (await loader())[exportName] }));

const HttpBuilderTool = lazyNamed(() => import('../NetworkTools'), 'HttpBuilderTool');
const UrlParser = lazyNamed(() => import('../UrlParser'), 'UrlParser');
const UserAgentTool = lazyNamed(() => import('../NetworkTools'), 'UserAgentTool');
const IpInfoTool = lazyNamed(() => import('../NetworkTools'), 'IpInfoTool');
const DeviceInfoTool = lazyNamed(() => import('../WebTools'), 'DeviceInfoTool');

const subTools: SubTool[] = [
  { id: 'http', name: 'HTTP 请求', description: '简易 HTTP Client', icon: Send, component: HttpBuilderTool },
  { id: 'urlparser', name: 'URL 解析器', description: '解析 URL 结构', icon: Globe, component: UrlParser },
  { id: 'useragent', name: 'User Agent', description: 'UA 解析', icon: Monitor, component: UserAgentTool },
  { id: 'ip', name: 'IP 信息', description: '本机 IP 查询', icon: Globe, component: IpInfoTool },
  { id: 'device', name: '设备信息', description: '浏览器/系统参数', icon: Monitor, component: DeviceInfoTool },
];

export const NetworkClientInspector: React.FC = () => {
  return (
    <TabbedToolbox
      title="网络请求与客户端探针"
      description="包含在线 HTTP 简易客户端、URL 分解、IP 与 User-Agent 解析及当前浏览器参数测定"
      tools={subTools}
      defaultTab="http"
    />
  );
};
