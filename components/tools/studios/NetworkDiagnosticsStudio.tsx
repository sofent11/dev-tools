import React from 'react';
import { Activity, Globe, Monitor, Send, Wifi } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const HttpBuilderTool = lazyNamed(() => import('../NetworkTools'), 'HttpBuilderTool');
const WebSocketSseSandboxTool = lazyNamed(() => import('../NetworkTools'), 'WebSocketSseSandboxTool');
const UrlParser = lazyNamed(() => import('../UrlParser'), 'UrlParser');
const UserAgentTool = lazyNamed(() => import('../NetworkTools'), 'UserAgentTool');
const IpInfoTool = lazyNamed(() => import('../NetworkTools'), 'IpInfoTool');
const DeviceInfoTool = lazyNamed(() => import('../WebTools'), 'DeviceInfoTool');
const PingAnalyzerTool = lazyNamed(() => import('../NetworkTools'), 'PingAnalyzerTool');

const subTools: SubTool[] = [
  { id: 'http', name: 'HTTP 请求', description: '简易 HTTP Client', icon: Send, component: HttpBuilderTool },
  { id: 'websocket-sse', name: 'WebSocket & SSE 沙箱', description: '实时双向长连接调试', icon: Wifi, component: WebSocketSseSandboxTool },
  { id: 'ping', name: 'Ping 延迟诊断', description: '本地网络时延与抖动探针', icon: Activity, component: PingAnalyzerTool },
  { id: 'urlparser', name: 'URL 解析器', description: '解析 URL 结构', icon: Globe, component: UrlParser },
  { id: 'useragent', name: 'User Agent', description: 'UA 解析', icon: Monitor, component: UserAgentTool },
  { id: 'ip', name: 'IP 信息', description: '本机 IP 查询', icon: Globe, component: IpInfoTool },
  { id: 'device', name: '设备信息', description: '浏览器/系统参数', icon: Monitor, component: DeviceInfoTool },
];

export const NetworkDiagnosticsStudio: React.FC = () => (
  <TabbedToolbox
    title="接口请求与网络诊断工作室"
    description="面向接口联调、长连接测试、地址解析和客户端环境探测的网络调试工作台"
    tools={subTools}
    defaultTab="http"
  />
);
