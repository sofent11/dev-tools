/**
 * video-catch Cloudflare Worker
 *
 * Deploy this file as a Cloudflare Worker, then call:
 *   GET  https://your-worker.example.workers.dev/api/extract?url=VIDEO_URL
 *   POST https://your-worker.example.workers.dev/api/extract {"url":"VIDEO_URL"}
 *
 * Ported from https://github.com/temjoy/video-catch with Worker-compatible fetch APIs.
 * Twitter/X is intentionally unsupported here because the upstream parser depends on yt-dlp.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-max-age': '86400',
};

const PLATFORM_PATTERNS = {
  twitter: [/(?:https?:\/\/)?(?:www\.)?twitter\.com\/.+\/status\//i, /(?:https?:\/\/)?(?:www\.)?x\.com\/.+\/status\//i, /(?:https?:\/\/)?t\.co\//i],
  xiaohongshu: [/(?:https?:\/\/)?(?:www\.)?xiaohongshu\.com\//i, /(?:https?:\/\/)?xhslink\.com\//i, /(?:https?:\/\/)?(?:www\.)?xhs\.cn\//i],
  pinterest: [/(?:https?:\/\/)?(?:www\.)?pinterest\.com\/pin\//i, /(?:https?:\/\/)?pin\.it\//i, /(?:https?:\/\/)?(?:www\.)?pinterest\.[a-z.]+\/pin\//i],
  bilibili: [/(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\//i, /(?:https?:\/\/)?(?:m\.)?bilibili\.com\/video\//i, /(?:https?:\/\/)?b23\.tv\//i, /(?:https?:\/\/)?(?:www\.)?bilibili\.com\/bangumi\//i],
  vimeo: [/(?:https?:\/\/)?(?:www\.)?vimeo\.com\/\d+/i, /(?:https?:\/\/)?player\.vimeo\.com\/video\/\d+/i, /(?:https?:\/\/)?vimeo\.com\/channels\/.+\/\d+/i, /(?:https?:\/\/)?vimeo\.com\/groups\/.+\/videos\/\d+/i],
  douyin: [/(?:https?:\/\/)?(?:www\.)?douyin\.com\/video\/\d+/i, /(?:https?:\/\/)?v\.douyin\.com\//i, /(?:https?:\/\/)?(?:www\.)?iesdouyin\.com\/share\/video\/\d+/i],
};

const QUALITY_MAP = {
  127: '8K',
  126: '杜比视界',
  125: 'HDR',
  120: '4K',
  116: '1080P60',
  112: '1080P+',
  80: '1080P',
  74: '720P60',
  64: '720P',
  32: '480P',
  16: '360P',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: JSON_HEADERS });
    }

    try {
      const parsed = new URL(request.url);
      if (parsed.pathname === '/' || parsed.pathname === '/health') {
        return json({
          ok: true,
          name: 'video-catch-worker',
          usage: {
            get: '/api/extract?url=https%3A%2F%2Fwww.bilibili.com%2Fvideo%2FBV...',
            post: { url: 'https://vimeo.com/76979871' },
          },
          supported: ['bilibili', 'douyin', 'xiaohongshu', 'pinterest', 'vimeo', 'generic direct media'],
          unsupported: ['twitter/x: upstream requires yt-dlp, unavailable in Cloudflare Workers'],
        });
      }

      if (parsed.pathname !== '/api/extract') {
        return json({ ok: false, error: 'Not found' }, 404);
      }

      const inputUrl = await readInputUrl(request, parsed);
      if (!inputUrl) {
        return json({ ok: false, error: 'Missing url. Use /api/extract?url=...' }, 400);
      }

      const result = await extract(inputUrl, env);
      return json({ ok: true, ...result });
    } catch (error) {
      return json(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
};

async function readInputUrl(request, parsed) {
  if (request.method === 'GET') {
    return parsed.searchParams.get('url')?.trim() || '';
  }
  if (request.method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      return typeof body.url === 'string' ? body.url.trim() : '';
    }
    const form = await request.formData().catch(() => null);
    return form?.get('url')?.toString().trim() || '';
  }
  throw new Error(`Unsupported method: ${request.method}`);
}

async function extract(url, env) {
  const platform = detectPlatform(url);

  if (isDirectMedia(url)) return { ...parseDirect(url), platform: 'direct' };
  if (platform === 'unknown') return { ...(await extractGeneric(url)), platform: 'generic' };
  if (platform === 'twitter') throw new Error('Twitter/X is not supported in Worker mode because yt-dlp cannot run in Cloudflare Workers.');

  const parsers = {
    bilibili: extractBilibili,
    douyin: extractDouyin,
    xiaohongshu: extractXiaohongshu,
    pinterest: extractPinterest,
    vimeo: extractVimeo,
  };

  const parser = parsers[platform];
  if (!parser) throw new Error(`No Worker parser for platform: ${platform}`);
  const result = await parser(url, env);
  return { ...result, platform };
}

function detectPlatform(url) {
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some(pattern => pattern.test(url))) return platform;
  }
  return 'unknown';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: JSON_HEADERS });
}

function isDirectMedia(url) {
  return /\.(mp4|m4v|webm|mov|m3u8|mpd)(?:[?#].*)?$/i.test(url);
}

function parseDirect(url) {
  const name = safeDecode(url.split('/').pop()?.split('?')[0] || 'video');
  return {
    title: name,
    thumbnail: null,
    duration: null,
    author: null,
    formats: [
      {
        quality: guessQuality(url, 0),
        url,
        format: getExtension(url),
      },
    ],
  };
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, {
    redirect: options.redirect || 'follow',
    headers: {
      'user-agent': USER_AGENT,
      accept: options.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': options.language || 'zh-CN,zh;q=0.9,en;q=0.8',
      referer: options.referer || '',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return response.text();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    redirect: options.redirect || 'follow',
    body: options.body,
    headers: {
      'user-agent': USER_AGENT,
      accept: options.accept || 'application/json,text/plain;q=0.9,*/*;q=0.8',
      'accept-language': options.language || 'zh-CN,zh;q=0.9,en;q=0.8',
      referer: options.referer || '',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return response.json();
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function formatMsDuration(ms) {
  if (!ms) return null;
  return formatDuration(Math.floor(ms / 1000));
}

function formatFileSize(size) {
  if (!size || size <= 0) return null;
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  return `${(size / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

function getExtension(url) {
  try {
    const match = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
    return match?.[1]?.toLowerCase() || 'mp4';
  } catch {
    return url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1]?.toLowerCase() || 'mp4';
  }
}

function guessQuality(url, index) {
  const decoded = safeDecode(url);
  const explicit = decoded.match(/(?:^|[^\d])((?:2160|1440|1080|720|540|480|360|240)p?)(?:[^\d]|$)/i)?.[1];
  if (explicit) return explicit.toUpperCase().replace('P', 'p');
  if (/m3u8/i.test(url)) return 'HLS';
  if (/mpd/i.test(url)) return 'DASH';
  return index === 0 ? '默认' : `候选 ${index + 1}`;
}

function uniqueFormats(formats) {
  const seen = new Set();
  return formats.filter(format => {
    if (!format?.url || seen.has(format.url)) return false;
    seen.add(format.url);
    return true;
  });
}

function absolutize(candidate, baseUrl) {
  const cleaned = decodeEntities(normalizeEscaped(candidate)).trim();
  try {
    return new URL(cleaned, baseUrl).href;
  } catch {
    return cleaned;
  }
}

function normalizeEscaped(value) {
  return String(value || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function metaContent(html, property) {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${escapeRegExp(property)}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  return decodeEntities(html.match(pattern)?.[1] || '');
}

function pageTitle(html) {
  return decodeEntities(metaContent(html, 'og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '未命名视频');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatsFromText(text, pageUrl, source, referer) {
  const normalized = normalizeEscaped(text);
  const mediaMatches = [...normalized.matchAll(/https?:\\?\/\\?\/[^"'<>\\\s]+?\.(?:mp4|m4v|webm|mov|m3u8|mpd)(?:\?[^"'<>\\\s]*)?/gi)];
  const mediaFormats = mediaMatches.map((match, index) => {
    const url = absolutize(match[0], pageUrl);
    return {
      quality: guessQuality(url, index),
      url,
      format: getExtension(url),
      source,
      ...(referer ? { referer } : {}),
    };
  });

  const tagFormats = [...normalized.matchAll(/<(?:source|video)[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((match, index) => {
    const url = absolutize(match[1], pageUrl);
    return {
      quality: guessQuality(url, index),
      url,
      format: getExtension(url),
      source: `${source} tag`,
      ...(referer ? { referer } : {}),
    };
  });

  return uniqueFormats([...mediaFormats, ...tagFormats]);
}

async function extractGeneric(url) {
  const html = await fetchText(url);
  const formats = formatsFromText(html, url, 'generic-page');
  if (!formats.length) throw new Error('No mp4, m3u8, webm or DASH URL found in this page.');
  return {
    title: pageTitle(html),
    thumbnail: metaContent(html, 'og:image') || null,
    duration: null,
    author: metaContent(html, 'author') || null,
    formats,
  };
}

async function extractBilibili(inputUrl) {
  let url = inputUrl;
  if (/b23\.tv/i.test(url)) {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': USER_AGENT } });
    url = response.url || url;
  }

  const bvid = url.match(/(BV[a-zA-Z0-9]{10})/)?.[1];
  const avid = !bvid ? url.match(/av(\d+)/i)?.[1] : null;
  if (!bvid && !avid) throw new Error('Cannot extract Bilibili video ID from URL.');

  const viewUrl = new URL('https://api.bilibili.com/x/web-interface/view');
  if (bvid) viewUrl.searchParams.set('bvid', bvid);
  if (avid) viewUrl.searchParams.set('aid', avid);

  const view = await fetchJson(viewUrl.href, { referer: 'https://www.bilibili.com/' });
  if (view.code !== 0) throw new Error(`Bilibili API error: ${view.message || 'unknown'}`);
  const info = view.data;

  let cid = info.cid;
  let title = info.title || 'Bilibili Video';
  const page = Number(new URL(url).searchParams.get('p') || '1');
  if (Array.isArray(info.pages) && info.pages[page - 1]) {
    const pageInfo = info.pages[page - 1];
    cid = pageInfo.cid || cid;
    if (info.pages.length > 1 && pageInfo.part) title = `${title} - ${pageInfo.part}`;
  }
  if (!cid) throw new Error('Cannot get Bilibili cid.');

  const formats = [];
  for (const useDash of [false, true]) {
    const playUrl = new URL('https://api.bilibili.com/x/player/playurl');
    if (info.bvid || bvid) playUrl.searchParams.set('bvid', info.bvid || bvid);
    playUrl.searchParams.set('cid', String(cid));
    playUrl.searchParams.set('qn', '120');
    playUrl.searchParams.set('fnval', useDash ? '16' : '0');
    playUrl.searchParams.set('fourk', '1');

    try {
      const play = await fetchJson(playUrl.href, { referer: 'https://www.bilibili.com/' });
      if (play.code !== 0) continue;
      if (!useDash) formats.push(...buildBilibiliDurlFormats(play.data));
      if (useDash) formats.push(...buildBilibiliDashFormats(play.data));
    } catch {
      // Keep trying the other mode.
    }
  }

  const deduped = uniqueFormats(formats).map(format => ({ ...format, referer: 'https://www.bilibili.com/' }));
  if (!deduped.length) throw new Error('Cannot get Bilibili video download URLs.');

  const thumbnail = info.pic?.startsWith('http://') ? `https://${info.pic.slice(7)}` : info.pic || null;
  return {
    title,
    thumbnail,
    duration: formatDuration(info.duration),
    author: info.owner?.name || null,
    formats: deduped,
  };
}

function buildBilibiliDurlFormats(playData) {
  const quality = QUALITY_MAP[playData?.quality] || String(playData?.quality || '默认');
  return (playData?.durl || []).flatMap(entry => {
    if (!entry.url) return [];
    return [
      {
        quality,
        url: entry.url,
        format: 'mp4',
        ...(entry.size ? { fileSize: formatFileSize(entry.size) } : {}),
      },
    ];
  });
}

function buildBilibiliDashFormats(playData) {
  const seen = new Map();
  for (const track of playData?.dash?.video || []) {
    const qid = track.id || 0;
    const url = track.baseUrl || track.base_url;
    if (!url) continue;
    const isAvc = String(track.codecs || '').toLowerCase().includes('avc');
    if (seen.has(qid) && (!isAvc || seen.get(qid)._isAvc)) continue;
    seen.set(qid, {
      quality: QUALITY_MAP[qid] || String(qid),
      resolution: track.width && track.height ? `${track.width}x${track.height}` : undefined,
      url,
      format: 'mp4',
      videoOnly: true,
      _isAvc: isAvc,
    });
  }
  return [...seen.entries()]
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([, value]) => {
      delete value._isAvc;
      return value;
    });
}

async function extractVimeo(inputUrl) {
  const match = inputUrl.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-f0-9]+))?/i) || inputUrl.match(/player\.vimeo\.com\/video\/(\d+)/i);
  if (!match) throw new Error('Could not extract Vimeo video ID.');
  const videoId = match[1];
  const unlistedHash = match[2];
  const embedUrl = `https://player.vimeo.com/video/${videoId}${unlistedHash ? `?h=${unlistedHash}` : ''}`;
  const html = await fetchText(embedUrl, { language: 'en-US,en;q=0.9' });
  const config = extractPlayerConfig(html) || (await fetchJson(`https://player.vimeo.com/video/${videoId}/config`));
  const video = config.video || {};
  const files = config.request?.files || {};

  const progressive = files.progressive || [];
  if (progressive.length) {
    const seen = new Set();
    const formats = progressive
      .sort((a, b) => (b.height || 0) - (a.height || 0))
      .flatMap(item => {
        const height = item.height;
        if (!height || seen.has(height) || !item.url) return [];
        seen.add(height);
        return [
          {
            quality: `${height}p`,
            resolution: item.width && height ? `${item.width}x${height}` : undefined,
            fileSize: formatFileSize(item.size),
            url: item.url,
            format: 'mp4',
          },
        ];
      })
      .slice(0, 5);
    if (formats.length) return vimeoResult(video, formats);
  }

  const hlsCdns = files.hls?.cdns || {};
  const hlsFormats = Object.values(hlsCdns).flatMap((cdn, index) =>
    cdn?.url ? [{ quality: index === 0 ? 'HLS' : `HLS ${index + 1}`, url: cdn.url, format: 'm3u8' }] : [],
  );
  if (hlsFormats.length) return vimeoResult(video, hlsFormats);

  const dashCdns = files.dash?.cdns || {};
  const dashFormats = Object.values(dashCdns).flatMap((cdn, index) =>
    (cdn?.avc_url || cdn?.url) ? [{ quality: index === 0 ? 'DASH' : `DASH ${index + 1}`, url: cdn.avc_url || cdn.url, format: 'mpd' }] : [],
  );
  if (dashFormats.length) return vimeoResult(video, dashFormats);

  throw new Error('No video streams found in Vimeo playerConfig.');
}

function extractPlayerConfig(html) {
  const start = html.indexOf('window.playerConfig');
  if (start === -1) return null;
  const braceStart = html.indexOf('{', start);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < html.length; i += 1) {
    if (html[i] === '{') depth += 1;
    if (html[i] === '}') depth -= 1;
    if (depth === 0) {
      try {
        return JSON.parse(html.slice(braceStart, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function vimeoResult(video, formats) {
  const thumbs = video.thumbs || {};
  return {
    title: video.title || 'Vimeo Video',
    thumbnail: video.thumbnail_url || thumbs['1280'] || thumbs['960'] || thumbs['640'] || thumbs.base || null,
    duration: formatDuration(video.duration),
    author: video.owner?.name || null,
    formats,
  };
}

async function extractDouyin(inputUrl, env) {
  const url = await resolveDouyinUrl(inputUrl);
  const videoId = url.match(/\/video\/(\d+)/)?.[1] || url.match(/modal_id=(\d+)/)?.[1];
  if (!videoId) throw new Error('Could not extract Douyin video ID.');

  const viaSsr = await extractDouyinViaSsr(videoId, env);
  if (viaSsr) return viaSsr;
  const viaApi = await extractDouyinViaWebApi(videoId, env);
  if (viaApi) return viaApi;
  throw new Error('Cannot extract Douyin video. Cloudflare region/IP may be blocked by Douyin.');
}

async function resolveDouyinUrl(url) {
  if (/douyin\.com\/video\//i.test(url)) return url;
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    return response.url || url;
  } catch {
    return url;
  }
}

async function getDouyinTtwid() {
  try {
    const response = await fetch('https://ttwid.bytedance.com/ttwid/union/register/', {
      method: 'POST',
      body: JSON.stringify({
        region: 'cn',
        aid: 6383,
        needFid: false,
        service: 'www.douyin.com',
        migrate_info: { ticket: '', source: 'worker' },
        cbUrlProtocol: 'https',
        union: true,
      }),
      headers: {
        'content-type': 'application/json',
      },
    });
    return response.headers.get('set-cookie')?.match(/ttwid=([^;]+)/)?.[1] || '';
  } catch {
    return '';
  }
}

async function extractDouyinViaSsr(videoId) {
  try {
    const ttwid = await getDouyinTtwid();
    const html = await fetchText(`https://www.iesdouyin.com/share/video/${videoId}/`, {
      language: 'zh-CN,zh;q=0.9',
      headers: {
        cookie: ttwid ? `ttwid=${ttwid}` : '',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    });
    const raw = html.match(/window\._ROUTER_DATA\s*=\s*(\{.+?\})\s*<\/script>/s)?.[1];
    if (!raw) return null;
    const data = parseRelaxedJson(raw);
    const loader = data.loaderData || {};
    for (const value of Object.values(loader)) {
      const items = value?.videoInfoRes?.item_list || [];
      if (items[0]) return parseDouyinItem(items[0]);
    }
    return null;
  } catch {
    return null;
  }
}

async function extractDouyinViaWebApi(videoId) {
  try {
    const ttwid = await getDouyinTtwid();
    const apiUrl = new URL('https://www.douyin.com/aweme/v1/web/aweme/detail/');
    apiUrl.searchParams.set('aweme_id', videoId);
    apiUrl.searchParams.set('device_platform', 'webapp');
    apiUrl.searchParams.set('aid', '6383');
    const data = await fetchJson(apiUrl.href, {
      referer: `https://www.douyin.com/video/${videoId}`,
      headers: {
        cookie: ttwid ? `ttwid=${ttwid}` : '',
      },
    });
    return data.aweme_detail ? parseDouyinItem(data.aweme_detail) : null;
  } catch {
    return null;
  }
}

function parseRelaxedJson(raw) {
  const attempts = [
    raw,
    raw.replace(/\\u002F/gi, '/'),
    raw.replace(/\bundefined\b/g, 'null').replace(/\\u002F/gi, '/'),
  ];
  for (const item of attempts) {
    try {
      return JSON.parse(item);
    } catch {
      // Try next cleanup.
    }
  }
  throw new Error('Could not parse embedded JSON.');
}

function parseDouyinItem(item) {
  const video = item.video || {};
  const authorInfo = item.author || {};
  const title = item.desc?.trim() || '抖音视频';
  const coverUrls = video.cover?.url_list || [];
  const dynamicCoverUrls = video.dynamic_cover?.url_list || [];
  const thumbnail = coverUrls[0] || dynamicCoverUrls[0] || null;

  const formats = [];
  const seen = new Set();
  for (const bitRate of [...(video.bit_rate || [])].sort((a, b) => (b.play_addr?.height || 0) - (a.play_addr?.height || 0))) {
    const playAddr = bitRate.play_addr || {};
    const bestUrl = pickBestDouyinUrl(playAddr.url_list || []);
    if (!bestUrl) continue;
    const width = playAddr.width || 0;
    const height = playAddr.height || 0;
    const quality = qualityLabel(width, height);
    if (seen.has(quality)) continue;
    seen.add(quality);
    formats.push({
      quality,
      resolution: width && height ? `${width}x${height}` : undefined,
      fileSize: formatFileSize(playAddr.data_size),
      url: bestUrl,
      format: 'mp4',
    });
    if (formats.length >= 5) break;
  }

  if (!formats.length) {
    const playAddr = video.play_addr || {};
    const bestUrl = pickBestDouyinUrl(playAddr.url_list || []);
    if (bestUrl) {
      const width = playAddr.width || video.width || 0;
      const height = playAddr.height || video.height || 0;
      formats.push({
        quality: width && height ? qualityLabel(width, height) : '原画',
        resolution: width && height ? `${width}x${height}` : undefined,
        fileSize: formatFileSize(playAddr.data_size),
        url: bestUrl,
        format: 'mp4',
      });
    }
  }

  const downloadUrls = video.download_addr?.url_list || [];
  if (downloadUrls.length && !formats.some(format => format.quality === '原画')) {
    formats.unshift({
      quality: '原画',
      fileSize: formatFileSize(video.download_addr?.data_size),
      url: downloadUrls[0],
      format: 'mp4',
    });
  }

  if (!formats.length) throw new Error('No video found in this Douyin post.');
  return {
    title,
    thumbnail,
    duration: formatMsDuration(video.duration),
    author: authorInfo.nickname || null,
    formats: formats.slice(0, 5),
  };
}

function pickBestDouyinUrl(urls) {
  if (!urls?.length) return null;
  const clean = urls.find(url => url.includes('play') && !url.includes('playwm')) || urls[0];
  return clean.includes('playwm') ? clean.replace('playwm', 'play') : clean;
}

function qualityLabel(width, height) {
  const short = Math.max(width || 0, height || 0);
  if (short >= 2160) return '4K';
  if (short >= 1440) return '2K';
  if (short >= 1080) return '1080p';
  if (short >= 720) return '720p';
  if (short >= 480) return '480p';
  if (short >= 360) return '360p';
  return height ? `${height}p` : '原画';
}

async function extractXiaohongshu(url) {
  const html = await fetchText(url);
  let videoUrl = metaContent(html, 'og:video') || null;
  let title = metaContent(html, 'og:title') || '小红书视频';
  let thumbnail = metaContent(html, 'og:image') || null;
  let author = null;

  if (thumbnail?.startsWith('//')) thumbnail = `https:${thumbnail}`;

  const initialState = html.match(/window\.__INITIAL_STATE__\s*=\s*({.+?})\s*<\/script>/s)?.[1];
  if (initialState) {
    try {
      const state = parseRelaxedJson(initialState);
      const details = state.note?.noteDetailMap || {};
      for (const noteData of Object.values(details)) {
        const note = noteData?.note || {};
        title = note.title || title;
        author = note.user?.nickname || author;
        const stream = note.video?.media?.stream || {};
        for (const qualityKey of ['h265', 'h264', 'av1']) {
          for (const streamItem of stream[qualityKey] || []) {
            if (streamItem.masterUrl) {
              videoUrl = streamItem.masterUrl;
              break;
            }
          }
          if (videoUrl) break;
        }
        const image = note.imageList?.[0];
        if (image?.urlDefault || image?.url) thumbnail = image.urlDefault || image.url;
        break;
      }
    } catch {
      // Fall back to regex scanning below.
    }
  }

  if (!videoUrl) videoUrl = html.match(/https?:\/\/[^"']+\.mp4[^"']*/i)?.[0] || null;
  if (!videoUrl) throw new Error('Could not find video in this Xiaohongshu post. It might be an image post.');
  if (videoUrl.startsWith('//')) videoUrl = `https:${videoUrl}`;

  return {
    title,
    thumbnail,
    duration: null,
    author,
    formats: [{ quality: '原画', url: videoUrl, format: 'mp4' }],
  };
}

async function extractPinterest(inputUrl) {
  let url = inputUrl;
  if (/pin\.it/i.test(url)) url = await resolvePinterestShortUrl(url);
  const pinId = extractPinId(url);
  if (!pinId) throw new Error('Could not extract Pinterest pin ID.');

  const csrfToken = await getPinterestCsrf();
  const api = new URL('https://www.pinterest.com/resource/PinResource/get/');
  api.searchParams.set('source_url', `/pin/${pinId}/`);
  api.searchParams.set('data', JSON.stringify({ options: { id: pinId, field_set_key: 'detailed' }, context: {} }));

  const data = await fetchJson(api.href, {
    referer: 'https://www.pinterest.com/',
    headers: {
      'x-requested-with': 'XMLHttpRequest',
      'x-pinterest-pws-handler': 'www/pin.js',
      'x-app-version': '0',
      ...(csrfToken ? { 'x-csrftoken': csrfToken } : {}),
    },
  });
  const pin = data.resource_response?.data;
  if (!pin) throw new Error('Pin not found or data unavailable.');

  const title = String(pin.grid_title || pin.title || pin.description?.slice(0, 80) || 'Pinterest Pin').replace(/\s+/g, ' ').trim();
  const images = pin.images || {};
  const thumbnail = images.orig?.url || images['736x']?.url || images['564x']?.url || images['474x']?.url || null;
  const author = pin.pinner?.full_name || pin.pinner?.username || null;
  let formats = [];
  let duration = null;

  const videoList = pin.videos?.video_list || {};
  if (Object.keys(videoList).length) {
    formats = await extractPinterestFormats(videoList);
    duration = pinterestDuration(videoList);
  }

  if (!formats.length) {
    for (const page of pin.story_pin_data?.pages || []) {
      for (const block of page.blocks || []) {
        const blockList = block.video?.video_list || {};
        const pageFormats = await extractPinterestFormats(blockList);
        if (pageFormats.length) {
          formats.push(...pageFormats);
          duration ||= pinterestDuration(blockList);
        }
      }
    }
  }

  const embedUrl = pin.embed?.src || pin.embed?.url;
  if (!formats.length && embedUrl && /video|mp4/i.test(embedUrl)) {
    formats.push({ quality: 'Original', url: embedUrl, format: 'mp4', referer: 'https://www.pinterest.com/' });
  }

  if (!formats.length && thumbnail) {
    formats.push({ quality: 'Original Image', url: thumbnail, format: 'jpg', referer: 'https://www.pinterest.com/' });
  }
  if (!formats.length) throw new Error('Could not find video in this Pinterest pin.');

  return {
    title,
    thumbnail,
    duration,
    author,
    formats: uniqueFormats(formats).map(format => ({ ...format, referer: 'https://www.pinterest.com/' })),
  };
}

async function resolvePinterestShortUrl(url) {
  const code = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
  if (code) {
    try {
      const response = await fetch(`https://api.pinterest.com/url_shortener/${code}/redirect/`, {
        redirect: 'follow',
        headers: { 'user-agent': USER_AGENT },
      });
      if (/pinterest\..+\/pin\//i.test(response.url)) return response.url;
    } catch {
      // Try direct resolution.
    }
  }

  const response = await fetch(url, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': USER_AGENT } });
  if (/pinterest\./i.test(response.url)) return response.url;
  throw new Error('Could not resolve Pinterest short link. Try the full pinterest.com URL.');
}

function extractPinId(url) {
  const parsed = new URL(url);
  if (parsed.hostname === 'pin.it') return '';
  return url.match(/\/pin\/(?:[^/]*--)?(\d+)/)?.[1] || '';
}

async function getPinterestCsrf() {
  try {
    const response = await fetch('https://www.pinterest.com/', {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    return response.headers.get('set-cookie')?.match(/csrftoken=([^;]+)/)?.[1] || '';
  } catch {
    return '';
  }
}

async function extractPinterestFormats(videoList) {
  const formats = [];
  let hlsUrl = null;
  const entries = [];

  for (const [key, value] of Object.entries(videoList || {})) {
    if (!value?.url) continue;
    if (value.url.endsWith('.m3u8')) {
      hlsUrl = value.url;
      continue;
    }
    entries.push({ key, url: value.url, width: value.width || 0, height: value.height || 0 });
  }

  const seen = new Set();
  for (const entry of entries.sort((a, b) => b.height - a.height)) {
    if (seen.has(entry.height)) continue;
    seen.add(entry.height);
    formats.push({
      quality: entry.height ? `${entry.height}p` : entry.key,
      resolution: entry.width && entry.height ? `${entry.width}x${entry.height}` : undefined,
      url: entry.url,
      format: 'mp4',
    });
  }

  if (!formats.length && hlsUrl) {
    formats.push(...(await parsePinterestHls(hlsUrl)));
  }

  return formats;
}

async function parsePinterestHls(hlsUrl) {
  const formats = [];
  const masterText = await fetchText(hlsUrl, { referer: 'https://www.pinterest.com/' }).catch(() => '');
  if (!masterText) return formats;

  const base = `${hlsUrl.slice(0, hlsUrl.lastIndexOf('/'))}/`;
  const lines = masterText.trim().split(/\r?\n/);
  const streams = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
    const resolution = line.match(/RESOLUTION=(\d+)x(\d+)/);
    const next = lines[i + 1]?.trim();
    if (!next) continue;
    streams.push({
      width: resolution ? Number(resolution[1]) : 0,
      height: resolution ? Number(resolution[2]) : 0,
      subUrl: next.startsWith('http') ? next : base + next,
    });
  }

  for (const stream of streams.sort((a, b) => b.height - a.height)) {
    const subText = await fetchText(stream.subUrl, { referer: 'https://www.pinterest.com/' }).catch(() => '');
    const mapFile = subText.match(/EXT-X-MAP:URI="([^"]+)"/)?.[1];
    if (!mapFile) continue;
    const subBase = `${stream.subUrl.slice(0, stream.subUrl.lastIndexOf('/'))}/`;
    const mediaFile = mapFile.startsWith('http') ? mapFile : subBase + mapFile;
    formats.push({
      quality: stream.height ? `${stream.height}p` : `${stream.width}w`,
      resolution: stream.width && stream.height ? `${stream.width}x${stream.height}` : undefined,
      url: mediaFile,
      format: 'mp4',
    });
  }
  return formats;
}

function pinterestDuration(videoList) {
  for (const value of Object.values(videoList || {})) {
    if (value?.duration > 0) {
      const seconds = Math.floor(value.duration / 1000);
      return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }
  }
  return null;
}
