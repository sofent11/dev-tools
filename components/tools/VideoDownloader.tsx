import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Cpu,
  Copy,
  Download,
  ExternalLink,
  FileVideo,
  Link2,
  Loader2,
  PlayCircle,
  Terminal,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { CodePanel, FieldLabel, Input, Textarea } from '../ui/ToolUi';
import { videoCatchWorkerCode } from './videoCatchWorkerCode';
import { notifyToast } from './shared/notifyToast';
import { useScratchpadStore } from './shared/scratchpadStore';

type Platform = 'direct' | 'bilibili' | 'douyin' | 'xiaohongshu' | 'pinterest' | 'vimeo' | 'twitter' | 'generic';
type ParseMode = 'url' | 'source';
type ParseStatus = 'idle' | 'parsing' | 'success' | 'warning' | 'error';
type WorkerHealthState = 'idle' | 'checking' | 'ready' | 'error';

interface VideoFormat {
  id: string;
  quality: string;
  format: string;
  url: string;
  resolution?: string;
  fileSize?: string;
  source: string;
  referer?: string;
}

interface ParseResult {
  title: string;
  platform: Platform;
  thumbnail?: string;
  author?: string;
  duration?: string;
  formats: VideoFormat[];
  warnings: string[];
}

interface VimeoProgressiveFile {
  height?: number;
  mime?: string;
  quality?: string;
  url: string;
  width?: number;
}

interface VimeoHlsCdn {
  url?: string;
}

interface VimeoConfig {
  request?: {
    files?: {
      progressive?: VimeoProgressiveFile[];
      hls?: {
        cdns?: Record<string, VimeoHlsCdn>;
      };
    };
  };
  video?: {
    duration?: number;
    owner?: {
      name?: string;
    };
    thumbs?: Record<string, string>;
    title?: string;
  };
}

interface BilibiliViewResponse {
  data?: {
    cid?: number;
    duration?: number;
    owner?: {
      name?: string;
    };
    pic?: string;
    title?: string;
  };
  message?: string;
}

interface BilibiliDurl {
  size?: number;
  url: string;
}

interface BilibiliDashVideo {
  base_url?: string;
  baseUrl?: string;
  height?: number;
  id?: number;
  mimeType?: string;
  width?: number;
}

interface BilibiliPlayResponse {
  data?: {
    dash?: {
      video?: BilibiliDashVideo[];
    };
    durl?: BilibiliDurl[];
    quality?: number;
  };
}

const DIRECT_MEDIA_RE = /\.(mp4|m4v|webm|mov|m3u8|mpd)(?:[?#].*)?$/i;
const MEDIA_URL_RE = /https?:\\?\/\\?\/[^"'<>\\\s]+?\.(?:mp4|m4v|webm|mov|m3u8|mpd)(?:\?[^"'<>\\\s]*)?/gi;

const platformLabels: Record<Platform, string> = {
  direct: '直链',
  bilibili: 'Bilibili',
  douyin: '抖音',
  xiaohongshu: '小红书',
  pinterest: 'Pinterest',
  vimeo: 'Vimeo',
  twitter: 'Twitter / X',
  generic: '通用网页',
};

const platformHints: Record<Platform, string> = {
  direct: '浏览器可直接打开或保存。HLS/DASH 流建议用 ffmpeg 下载。',
  bilibili: 'Bilibili 下载通常需要 Referer，请复制命令或在下载器里带上请求头。',
  douyin: '抖音分享页经常要求中国大陆网络环境，并可能被 CORS 或风控拦截。',
  xiaohongshu: '小红书页面数据常在源码 JSON 中，跨域失败时可粘贴页面源码解析。',
  pinterest: 'Pinterest 的 HLS 资源通常需要 Referer；m3u8 可用 ffmpeg 转存。',
  vimeo: 'Vimeo 公开视频通常可解析 progressive MP4；私有视频取决于页面权限。',
  twitter: 'Twitter/X 公开视频常需要登录态或专用解析器，纯浏览器可能无法直接取到资源。',
  generic: '通用模式会扫描页面中的 video/source 标签、JSON 配置和媒体直链。',
};

const sampleUrl = 'https://vimeo.com/76979871';
const WORKER_ENDPOINT_STORAGE_KEY = 'video-catch-worker-endpoint';
const DEFAULT_WORKER_ENDPOINT = '';

const decodeHtml = (value: string) => {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const normalizeEscapedText = (value: string) =>
  value
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');

const extractFirstUrl = (value: string) => {
  const match = value.match(/https?:\/\/[^\s"'<>]+/i);
  return match?.[0] ?? value.trim();
};

const detectPlatform = (input: string): Platform => {
  try {
    const url = new URL(extractFirstUrl(input));
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (DIRECT_MEDIA_RE.test(url.href)) return 'direct';
    if (host.includes('bilibili.com') || host === 'b23.tv') return 'bilibili';
    if (host.includes('douyin.com')) return 'douyin';
    if (host.includes('xiaohongshu.com') || host.includes('xhslink.com')) return 'xiaohongshu';
    if (host.includes('pinterest.') || host === 'pin.it') return 'pinterest';
    if (host.includes('vimeo.com')) return 'vimeo';
    if (host.includes('twitter.com') || host === 'x.com') return 'twitter';
    return 'generic';
  } catch {
    return 'generic';
  }
};

const toAbsoluteUrl = (candidate: string, baseUrl: string) => {
  const cleaned = decodeHtml(normalizeEscapedText(candidate)).trim();
  try {
    return new URL(cleaned, baseUrl).href;
  } catch {
    return cleaned;
  }
};

const getExtension = (url: string) => {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  return pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? 'video';
};

const uniqueFormats = (formats: VideoFormat[]) => {
  const seen = new Set<string>();
  return formats.filter(format => {
    const key = format.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeWorkerEndpoint = (value: string) => value.trim().replace(/\/+$/, '');

const guessQuality = (url: string, index: number) => {
  const decoded = decodeURIComponent(url);
  const explicit = decoded.match(/(?:^|[^\d])((?:2160|1440|1080|720|540|480|360|240)p?)(?:[^\d]|$)/i)?.[1];
  if (explicit) return explicit.toUpperCase().replace('P', 'P');
  if (/m3u8/i.test(url)) return 'HLS';
  if (/mpd/i.test(url)) return 'DASH';
  return index === 0 ? '默认' : `候选 ${index + 1}`;
};

const getMetaContent = (html: string, property: string) => {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  return decodeHtml(html.match(pattern)?.[1] ?? '');
};

const getPageTitle = (html: string) =>
  decodeHtml(
    getMetaContent(html, 'og:title') ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ||
      '未命名视频',
  );

const formatsFromText = (text: string, pageUrl: string, source: string, referer?: string) => {
  const normalized = normalizeEscapedText(text);
  const matches = Array.from(normalized.matchAll(MEDIA_URL_RE));
  const formats = matches.map((match, index) => {
    const url = toAbsoluteUrl(match[0], pageUrl);
    return {
      id: `${source}-${index}-${url.slice(-12)}`,
      quality: guessQuality(url, index),
      format: getExtension(url),
      url,
      source,
      referer,
    };
  });

  const tagFormats = Array.from(normalized.matchAll(/<(?:source|video)[^>]+src=["']([^"']+)["'][^>]*>/gi)).map((match, index) => {
    const url = toAbsoluteUrl(match[1], pageUrl);
    return {
      id: `${source}-tag-${index}`,
      quality: guessQuality(url, index),
      format: getExtension(url),
      url,
      source: `${source} 标签`,
      referer,
    };
  });

  return uniqueFormats([...formats, ...tagFormats]);
};

const fetchText = async (url: string) => {
  const response = await fetch(url, {
    credentials: 'omit',
    headers: {
      Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
};

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'omit',
    headers: {
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

const parseDirect = (url: string): ParseResult => ({
  title: decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'video'),
  platform: 'direct',
  formats: [
    {
      id: 'direct-0',
      quality: guessQuality(url, 0),
      format: getExtension(url),
      url,
      source: '媒体直链',
    },
  ],
  warnings: [],
});

const parseVimeo = async (url: string): Promise<ParseResult> => {
  const id = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1];
  if (!id) throw new Error('没有识别到 Vimeo 视频 ID');

  const config = await fetchJson<VimeoConfig>(`https://player.vimeo.com/video/${id}/config`);
  const progressive = config?.request?.files?.progressive ?? [];
  const hls = config?.request?.files?.hls?.cdns;
  const hlsFormats = hls
    ? Object.values(hls).flatMap((cdn, index) =>
        cdn?.url
          ? [{
              id: `vimeo-hls-${index}`,
              quality: 'HLS',
              format: 'm3u8',
              url: cdn.url,
              source: 'Vimeo playerConfig',
            }]
          : [],
      )
    : [];

  const formats = uniqueFormats([
    ...progressive.map((item, index) => ({
      id: `vimeo-progressive-${index}`,
      quality: item.quality || guessQuality(item.url, index),
      format: item.mime?.split('/').pop() || getExtension(item.url),
      resolution: item.width && item.height ? `${item.width}x${item.height}` : undefined,
      url: item.url,
      source: 'Vimeo progressive',
    })),
    ...hlsFormats,
  ]);

  return {
    title: config?.video?.title || 'Vimeo 视频',
    platform: 'vimeo',
    thumbnail: config?.video?.thumbs?.base || config?.video?.thumbs?.['640'],
    author: config?.video?.owner?.name,
    duration: config?.video?.duration ? `${Math.round(config.video.duration)} 秒` : undefined,
    formats,
    warnings: formats.length ? [] : ['Vimeo 配置可访问，但没有发现可下载的 progressive/HLS 资源。'],
  };
};

const parseBilibili = async (url: string): Promise<ParseResult> => {
  const bvid = url.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1] || url.match(/\b(BV[a-zA-Z0-9]{10,})\b/)?.[1];
  if (!bvid) throw new Error('没有识别到 Bilibili BV 号');

  const view = await fetchJson<BilibiliViewResponse>(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
  const cid = view?.data?.cid;
  if (!cid) throw new Error(view?.message || '无法读取 Bilibili cid');

  const play = await fetchJson<BilibiliPlayResponse>(
    `https://api.bilibili.com/x/player/playurl?bvid=${encodeURIComponent(bvid)}&cid=${cid}&fnval=16&fourk=1`,
  );
  const durl = play?.data?.durl ?? [];
  const dashVideo = play?.data?.dash?.video ?? [];
  const formats = uniqueFormats([
    ...durl.map((item, index) => ({
      id: `bili-durl-${index}`,
      quality: play?.data?.quality ? `${play.data.quality}P` : guessQuality(item.url, index),
      format: getExtension(item.url),
      fileSize: item.size ? `${(item.size / 1024 / 1024).toFixed(1)} MB` : undefined,
      url: item.url,
      source: 'Bilibili playurl',
      referer: 'https://www.bilibili.com/',
    })),
    ...dashVideo.map((item, index) => ({
      id: `bili-dash-${index}`,
      quality: item.id ? `${item.id}P` : guessQuality(item.baseUrl || item.base_url, index),
      format: item.mimeType?.split('/').pop() || 'm4s',
      resolution: item.width && item.height ? `${item.width}x${item.height}` : undefined,
      url: item.baseUrl || item.base_url,
      source: 'Bilibili DASH',
      referer: 'https://www.bilibili.com/',
    })),
  ]);

  return {
    title: view?.data?.title || 'Bilibili 视频',
    platform: 'bilibili',
    thumbnail: view?.data?.pic,
    author: view?.data?.owner?.name,
    duration: view?.data?.duration ? `${view.data.duration} 秒` : undefined,
    formats,
    warnings: [
      '浏览器直接下载 Bilibili 资源可能被 Referer 拦截；复制 curl/ffmpeg 命令更稳定。',
      ...(formats.length ? [] : ['公开 API 响应成功，但没有发现可下载格式。']),
    ],
  };
};

const parseGenericPage = async (url: string, platform: Platform): Promise<ParseResult> => {
  const html = await fetchText(url);
  const formats = formatsFromText(html, url, '页面源码', platform === 'pinterest' ? 'https://www.pinterest.com/' : undefined);
  return {
    title: getPageTitle(html),
    platform,
    thumbnail: getMetaContent(html, 'og:image') || undefined,
    author: getMetaContent(html, 'author') || undefined,
    formats,
    warnings: formats.length ? [] : ['页面可访问，但没有扫描到 mp4、m3u8、webm 或 DASH 地址。'],
  };
};

const parseFromSource = (source: string, pageUrl: string, platform: Platform): ParseResult => {
  const baseUrl = pageUrl || window.location.href;
  const formats = formatsFromText(source, baseUrl, '粘贴源码', platform === 'pinterest' ? 'https://www.pinterest.com/' : undefined);
  return {
    title: getPageTitle(source),
    platform,
    thumbnail: getMetaContent(source, 'og:image') || undefined,
    author: getMetaContent(source, 'author') || undefined,
    formats,
    warnings: formats.length ? [] : ['源码中没有扫描到可识别的视频资源地址。'],
  };
};

const parseWithWorker = async (endpoint: string, url: string): Promise<ParseResult> => {
  const apiUrl = `${normalizeWorkerEndpoint(endpoint)}/api/extract`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Worker HTTP ${response.status}`);
  }

  const resultPlatform = (payload.platform || detectPlatform(url)) as Platform;
  const formats = uniqueFormats((payload.formats || []).map((format: Partial<VideoFormat>, index: number) => {
    const formatUrl = format.url || '';
    return {
      id: `worker-${index}-${formatUrl.slice(-12)}`,
      quality: format.quality || guessQuality(formatUrl, index),
      format: format.format || getExtension(formatUrl),
      resolution: format.resolution,
      fileSize: format.fileSize,
      url: formatUrl,
      source: format.source || 'Cloudflare Worker',
      referer: format.referer,
    };
  }));

  return {
    title: payload.title || '视频',
    platform: resultPlatform,
    thumbnail: payload.thumbnail || undefined,
    author: payload.author || undefined,
    duration: payload.duration || undefined,
    formats,
    warnings: payload.warnings || [],
  };
};

const checkWorkerHealth = async (endpoint: string, signal?: AbortSignal) => {
  const response = await fetch(`${normalizeWorkerEndpoint(endpoint)}/health`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok !== true) {
    throw new Error(payload?.error || `Worker HTTP ${response.status}`);
  }
  return payload as { supported?: string[]; unsupported?: string[] };
};

const buildCommand = (format: VideoFormat) => {
  const output = `video.${format.format === 'm3u8' || format.format === 'mpd' ? 'mp4' : format.format}`;
  const header = format.referer ? ` -H "Referer: ${format.referer}"` : '';
  if (format.format === 'm3u8' || format.format === 'mpd') {
    return `ffmpeg${format.referer ? ` -headers "Referer: ${format.referer}\\r\\n"` : ''} -i "${format.url}" -c copy "${output}"`;
  }
  return `curl -L${header} -o "${output}" "${format.url}"`;
};

const getBlockedWarning = (platform: Platform) =>
  `浏览器无法直接访问该页面或接口，常见原因是 CORS、登录态、地区限制或平台风控。你仍可以打开原页面，查看网页源码后粘贴到“源码解析”模式中扫描媒体地址。${platformHints[platform]}`;

export const VideoDownloader: React.FC = () => {
  const [mode, setMode] = useState<ParseMode>('url');
  const [input, setInput] = useState(sampleUrl);
  const [workerEndpoint, setWorkerEndpoint] = useState(() => localStorage.getItem(WORKER_ENDPOINT_STORAGE_KEY) || DEFAULT_WORKER_ENDPOINT);
  const [workerHealth, setWorkerHealth] = useState<WorkerHealthState>('idle');
  const [workerHealthMessage, setWorkerHealthMessage] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<ParseStatus>('idle');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showWorkerInfo, setShowWorkerInfo] = useState(false);
  const [workerScriptCopied, setWorkerScriptCopied] = useState(false);

  const copyWorkerScript = async () => {
    await navigator.clipboard.writeText(videoCatchWorkerCode);
    setWorkerScriptCopied(true);
    window.setTimeout(() => setWorkerScriptCopied(false), 2000);
  };

  const targetUrl = useMemo(() => extractFirstUrl(input), [input]);
  const platform = useMemo(() => detectPlatform(input), [input]);
  const selectedFormats = result?.formats ?? [];
  const hasPreview = selectedFormats.some(format => ['mp4', 'm4v', 'webm', 'mov'].includes(format.format));
  const previewUrl = selectedFormats.find(format => ['mp4', 'm4v', 'webm', 'mov'].includes(format.format))?.url;

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(current => (current === id ? null : current)), 1200);
  };

  const stashFormat = async (format: VideoFormat) => {
    await useScratchpadStore.getState().addItemAsync({
      name: `video_${format.quality}_${Date.now()}.txt`,
      content: `${format.url}\n\n${buildCommand(format)}`,
      type: 'text',
      mimeType: 'text/plain',
      sourceTool: '视频下载解析器',
    });
    notifyToast({ title: '视频候选已送入暂存箱', description: format.quality, tone: 'success' });
  };

  const handleWorkerEndpointChange = (value: string) => {
    setWorkerEndpoint(value);
    setWorkerHealth('idle');
    setWorkerHealthMessage('');
    const normalized = normalizeWorkerEndpoint(value);
    if (normalized) {
      localStorage.setItem(WORKER_ENDPOINT_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(WORKER_ENDPOINT_STORAGE_KEY);
    }
  };

  const runWorkerHealthCheck = async () => {
    const endpoint = normalizeWorkerEndpoint(workerEndpoint);
    if (!endpoint) {
      setWorkerHealth('error');
      setWorkerHealthMessage('请先填入您自己的 Cloudflare Worker API 域名。');
      return;
    }
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    setWorkerHealth('checking');
    setWorkerHealthMessage('');
    try {
      const payload = await checkWorkerHealth(endpoint, controller.signal);
      setWorkerHealth('ready');
      setWorkerHealthMessage(`Worker 可用。支持：${payload.supported?.join('、') || '公开视频解析'}。`);
      notifyToast({ title: 'Worker 健康检查通过', description: endpoint, tone: 'success' });
    } catch (err) {
      const message = err instanceof Error && err.name === 'AbortError'
        ? 'Worker 健康检查超时，请确认域名和网络。'
        : err instanceof Error ? err.message : 'Worker 健康检查失败';
      setWorkerHealth('error');
      setWorkerHealthMessage(message);
      notifyToast({ title: 'Worker 健康检查失败', description: message, tone: 'error' });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const parse = async () => {
    setStatus('parsing');
    setMessage('');
    setResult(null);

    try {
      const nextPlatform = detectPlatform(input);
      let nextResult: ParseResult;

      if (mode === 'source') {
        nextResult = parseFromSource(source, targetUrl, nextPlatform);
      } else if (normalizeWorkerEndpoint(workerEndpoint)) {
        nextResult = await parseWithWorker(workerEndpoint, targetUrl);
      } else if (nextPlatform === 'direct') {
        nextResult = parseDirect(targetUrl);
      } else if (nextPlatform === 'vimeo') {
        nextResult = await parseVimeo(targetUrl);
      } else if (nextPlatform === 'bilibili') {
        nextResult = await parseBilibili(targetUrl);
      } else {
        nextResult = await parseGenericPage(targetUrl, nextPlatform);
      }

      setResult(nextResult);
      if (nextResult.formats.length === 0 || nextResult.warnings.length > 0) {
        setStatus(nextResult.formats.length ? 'warning' : 'error');
        setMessage(nextResult.warnings[0] || '没有发现可下载的视频地址。');
      } else {
        setStatus('success');
        setMessage(`已找到 ${nextResult.formats.length} 个候选视频地址。`);
      }
    } catch (error) {
      const nextPlatform = detectPlatform(input);
      setStatus('warning');
      setMessage(`${normalizeWorkerEndpoint(workerEndpoint) ? '私有 Worker 解析失败，可切换源码解析或检查 Worker 健康状态。' : getBlockedWarning(nextPlatform)}（${error instanceof Error ? error.message : '解析失败'}）`);
      setResult({
        title: normalizeWorkerEndpoint(workerEndpoint) ? 'Worker 解析失败' : '解析受限',
        platform: nextPlatform,
        formats: [],
        warnings: [normalizeWorkerEndpoint(workerEndpoint) ? '请确认 Worker 已部署、域名正确、允许 CORS，并通过健康检查。' : getBlockedWarning(nextPlatform)],
      });
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="视频下载解析器"
        description="本地优先解析媒体直链、公开页面和源码中的视频资源；平台受登录态、地区、CORS 与风控限制，私有 Worker 为可选增强。"
        actions={
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode('url')}
              className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${
                mode === 'url' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              链接
            </button>
            <button
              type="button"
              onClick={() => setMode('source')}
              className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors ${
                mode === 'source' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clipboard className="h-3.5 w-3.5" />
              源码
            </button>
          </div>
        }
      />

      <CardContent className="app-scrollbar min-h-0 flex-1 overflow-auto p-0">
        <div className="grid min-h-full grid-cols-1 lg:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.4fr)]">
          <div className="border-b border-slate-200 bg-slate-50/70 p-5 lg:border-b-0 lg:border-r">
            <div className="space-y-4">
              <div>
                <FieldLabel hint={platformLabels[platform]}>视频页面或媒体直链</FieldLabel>
                <Input
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  placeholder="粘贴 Bilibili / Vimeo / Pinterest / mp4 / m3u8 链接"
                  className="font-mono"
                />
              </div>

              <div>
                <FieldLabel hint={workerEndpoint ? '优先使用' : '可选'}>Cloudflare Worker API</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    value={workerEndpoint}
                    onChange={event => handleWorkerEndpointChange(event.target.value)}
                    placeholder="https://your-worker.your-name.workers.dev"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={runWorkerHealthCheck}
                    isLoading={workerHealth === 'checking'}
                  >
                    检测
                  </Button>
                </div>
                <div className={`mt-1 text-[11px] leading-5 ${
                  workerHealth === 'ready' ? 'text-emerald-700' : workerHealth === 'error' ? 'text-amber-700' : 'text-slate-500'
                }`}>
                  {workerHealthMessage || (workerEndpoint ? '填入后会优先调用您的私有 Worker；建议先点击检测。' : '默认不使用第三方 Worker，避免把解析流量发往未知服务。')}
                </div>
              </div>

              {mode === 'source' && (
                <div>
                  <FieldLabel hint="跨域失败时使用">页面源码 / JSON 配置</FieldLabel>
                  <Textarea
                    value={source}
                    onChange={event => setSource(event.target.value)}
                    placeholder="粘贴网页源码、__INITIAL_STATE__、playerConfig 或接口 JSON..."
                    className="min-h-56 resize-y font-mono text-xs"
                  />
                </div>
              )}

              <Button
                onClick={parse}
                isLoading={status === 'parsing'}
                icon={status === 'parsing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                className="w-full"
              >
                开始解析
              </Button>

              <div className="tool-section overflow-hidden rounded-xl border border-slate-200/80 bg-white/50 p-4 shadow-sm backdrop-blur-sm transition-all duration-300">
                <button
                  type="button"
                  onClick={() => setShowWorkerInfo(!showWorkerInfo)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold text-slate-800 hover:text-slate-900"
                >
                  <span className="flex items-center gap-2">
                    <Cpu className={`h-4 w-4 transition-transform duration-500 ${showWorkerInfo ? 'text-indigo-600 rotate-180' : 'text-slate-500'}`} />
                    部署私有解析 Worker (推荐)
                  </span>
                  {showWorkerInfo ? (
                    <ChevronUp className="h-4 w-4 text-slate-500 transition-transform duration-300" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-300" />
                  )}
                </button>
                
                {showWorkerInfo ? (
                  <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600 transition-all duration-300">
                    <p className="text-slate-500">
                      大多数视频平台（如 Bilibili、抖音等）存在严格的跨域安全限制（CORS）。部署免费的 Cloudflare Worker 代理即可绕过限制，完美解锁全部解析功能。
                    </p>
                    <div className="rounded-lg bg-slate-50 p-2.5">
                      <div className="mb-1 font-semibold text-slate-800">极速部署步骤：</div>
                      <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                        <li>
                          登录 <a href="https://dash.cloudflare.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline hover:text-indigo-700">Cloudflare 仪表盘</a>，创建一个新的 Workers。
                        </li>
                        <li>
                          复制下方完整的解析脚本代码。
                        </li>
                        <li>
                          在 Cloudflare 网页编辑器中清空原有内容，粘贴脚本并点击「Deploy」。
                        </li>
                        <li>
                          复制部署成功后的 API 域名，填入上方的「Cloudflare Worker API」框中。
                        </li>
                      </ol>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant={workerScriptCopied ? 'secondary' : 'primary'}
                        icon={workerScriptCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        onClick={copyWorkerScript}
                        className="w-full justify-center py-2"
                      >
                        {workerScriptCopied ? '已复制 Worker 脚本！' : '一键复制 Worker 脚本'}
                      </Button>
                      <div className="relative">
                        <div className="absolute right-2 top-2 z-10 rounded bg-slate-800/80 px-2 py-0.5 text-[10px] text-white">
                          PREVIEW
                        </div>
                        <CodePanel muted className="max-h-36 overflow-y-auto font-mono text-[10px] leading-4 scrollbar-thin scrollbar-thumb-slate-300">
                          {videoCatchWorkerCode}
                        </CodePanel>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    填入 Worker 域名后优先调用远程 API。未配置时仅使用浏览器本地能力，部分平台将受限于跨域报错。
                  </p>
                )}
              </div>

              <div className="tool-panel p-4">
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500">平台提示</div>
                <p className="text-sm leading-6 text-slate-700">{platformHints[platform]}</p>
              </div>

              <div className="tool-panel p-4">
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500">能力矩阵</div>
                <div className="grid gap-2 text-xs text-slate-600">
                  <div className="flex justify-between gap-3"><span>媒体直链 / m3u8 / mpd</span><strong className="text-emerald-700">本地可用</strong></div>
                  <div className="flex justify-between gap-3"><span>页面源码扫描</span><strong className="text-emerald-700">本地可用</strong></div>
                  <div className="flex justify-between gap-3"><span>Vimeo / Bilibili 公开接口</span><strong className="text-amber-700">受 CORS/权限影响</strong></div>
                  <div className="flex justify-between gap-3"><span>抖音 / 小红书 / Pinterest</span><strong className="text-amber-700">建议私有 Worker</strong></div>
                  <div className="flex justify-between gap-3"><span>Twitter / X</span><strong className="text-red-700">纯浏览器不承诺支持</strong></div>
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 p-5">
            {status !== 'idle' && (
              <div
                className={`mb-4 flex items-start gap-3 p-3 text-sm ${
                  status === 'success' ? 'status-success' : status === 'error' ? 'status-error' : 'status-warning'
                }`}
              >
                {status === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <AlertTriangle className="mt-0.5 h-4 w-4" />}
                <span className="leading-5">{message || '准备解析。'}</span>
              </div>
            )}

            {result ? (
              <div className="space-y-5">
                <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row">
                  {result.thumbnail ? (
                    <img
                      src={result.thumbnail}
                      alt=""
                      className="aspect-video w-full rounded-lg border border-slate-200 object-cover md:w-56"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400 md:w-56">
                      <FileVideo className="h-10 w-10" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {platformLabels[result.platform]}
                    </div>
                    <h3 className="break-words text-lg font-semibold leading-7 text-slate-950">{result.title}</h3>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      {result.author && <span className="rounded border border-slate-200 px-2 py-1">作者：{result.author}</span>}
                      {result.duration && <span className="rounded border border-slate-200 px-2 py-1">时长：{result.duration}</span>}
                      <span className="rounded border border-slate-200 px-2 py-1">候选：{selectedFormats.length}</span>
                    </div>
                  </div>
                </div>

                {hasPreview && previewUrl && (
                  <div>
                    <div className="mb-2 text-sm font-semibold text-slate-800">预览</div>
                    <video src={previewUrl} controls className="aspect-video w-full rounded-lg bg-slate-950" />
                  </div>
                )}

                {selectedFormats.length > 0 ? (
                  <div className="space-y-3">
                    {selectedFormats.map((format, index) => (
                      <div key={format.id} className="tool-section p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                                {format.quality}
                              </span>
                              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                                {format.format}
                              </span>
                              {format.resolution && <span className="text-xs text-slate-500">{format.resolution}</span>}
                              {format.fileSize && <span className="text-xs text-slate-500">{format.fileSize}</span>}
                              <span className="text-xs text-slate-400">{format.source}</span>
                            </div>
                            <div className="break-all font-mono text-xs leading-5 text-slate-600">{format.url}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Copy className="h-3.5 w-3.5" />}
                              onClick={() => copyText(`url-${format.id}`, format.url)}
                            >
                              {copiedId === `url-${format.id}` ? '已复制' : '复制链接'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Terminal className="h-3.5 w-3.5" />}
                              onClick={() => copyText(`cmd-${format.id}`, buildCommand(format))}
                            >
                              {copiedId === `cmd-${format.id}` ? '已复制' : '复制命令'}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              icon={<Clipboard className="h-3.5 w-3.5" />}
                              onClick={() => stashFormat(format)}
                            >
                              暂存
                            </Button>
                            <a href={format.url} target="_blank" rel="noreferrer" download={`video-${index}.${format.format}`}>
                              <Button size="sm" icon={format.format === 'm3u8' || format.format === 'mpd' ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}>
                                {format.format === 'm3u8' || format.format === 'mpd' ? '打开' : '下载'}
                              </Button>
                            </a>
                          </div>
                        </div>
                        <CodePanel muted className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs">
                          {buildCommand(format)}
                        </CodePanel>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
                    暂无候选地址。切换到源码解析，粘贴页面 HTML 或 JSON 配置后可继续扫描。
                  </div>
                )}
              </div>
            ) : (
              <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
                <FileVideo className="mb-4 h-12 w-12 text-slate-300" />
                <div className="text-base font-semibold text-slate-800">等待解析视频地址</div>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  支持媒体直链、Vimeo/Bilibili 公开资源，以及页面源码中的 mp4 / m3u8 / webm / DASH 扫描；复杂平台请部署自己的 Worker 或改用源码解析。
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
