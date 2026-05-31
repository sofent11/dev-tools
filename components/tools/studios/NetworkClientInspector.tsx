import React from 'react';
import { Send, Globe, Monitor, FileVideo, Activity, Wifi } from 'lucide-react';
import { TabbedToolbox, SubTool, lazyNamed } from '../shared/TabbedToolbox';

const HttpBuilderTool = lazyNamed(() => import('../NetworkTools'), 'HttpBuilderTool');
const WebSocketSseSandboxTool = lazyNamed(() => import('../NetworkTools'), 'WebSocketSseSandboxTool');
const UrlParser = lazyNamed(() => import('../UrlParser'), 'UrlParser');
const UserAgentTool = lazyNamed(() => import('../NetworkTools'), 'UserAgentTool');
const IpInfoTool = lazyNamed(() => import('../NetworkTools'), 'IpInfoTool');
const DeviceInfoTool = lazyNamed(() => import('../WebTools'), 'DeviceInfoTool');
const VideoDownloader = lazyNamed(() => import('../VideoDownloader'), 'VideoDownloader');
const PingAnalyzerTool = lazyNamed(() => import('../NetworkTools'), 'PingAnalyzerTool');

const subTools: SubTool[] = [
  { id: 'http', name: 'HTTP 请求', description: '简易 HTTP Client', icon: Send, component: HttpBuilderTool },
  { id: 'websocket-sse', name: 'WebSocket & SSE 沙箱', description: '实时双向长连接调试', icon: Wifi, component: WebSocketSseSandboxTool },
  { id: 'ping', name: 'Ping 延迟诊断', description: '本地网络时延与抖动探针', icon: Activity, component: PingAnalyzerTool },
  { id: 'urlparser', name: 'URL 解析器', description: '解析 URL 结构', icon: Globe, component: UrlParser },
  { id: 'useragent', name: 'User Agent', description: 'UA 解析', icon: Monitor, component: UserAgentTool },
  { id: 'ip', name: 'IP 信息', description: '本机 IP 查询', icon: Globe, component: IpInfoTool },
  { id: 'device', name: '设备信息', description: '浏览器/系统参数', icon: Monitor, component: DeviceInfoTool },
  { id: 'video-download', name: '视频下载解析', description: '解析视频直链 / HLS 视频流', icon: FileVideo, component: VideoDownloader },
];

export const NetworkClientInspector: React.FC = () => {
  return (
    <TabbedToolbox
      title="网络请求与客户端探针"
      description="包含在线 HTTP 简易客户端、URL 分解、IP 与 User-Agent 解析、当前浏览器参数测定及在线视频流嗅探提取"
      tools={subTools}
      defaultTab="http"
    />
  );
};
