import {
  loadRuntimeAsset,
  notifyRuntimeAssetProgress,
  registerRuntimeAssetProgressListener,
  unregisterRuntimeAssetProgressListener,
  type RuntimeAssetLoaderState,
} from './runtimeAssetLoader';

const CACHE_NAME = 'devtoolbox-runtime-assets-cache';
let isInterceptorInstalled = false;

export type RemoteRuntimeStatus = RuntimeAssetLoaderState['status'];
export type RemoteRuntimeEvent = {
  src: string;
  label: string;
  status: RemoteRuntimeStatus;
  attempt: number;
  progress?: number;
  version?: string;
  message?: string;
  activeUrl?: string;
  sourceLabel?: string;
  verified?: boolean;
};

export interface LoadScriptOptions {
  label?: string;
  version?: string;
  fallbackUrls?: string[];
  sourceLabel?: string;
  expectedSha256?: string;
  timeoutMs?: number;
  retries?: number;
  onStatus?: (event: RemoteRuntimeEvent) => void;
}

export const registerCacheProgressListener = registerRuntimeAssetProgressListener;
export const unregisterCacheProgressListener = unregisterRuntimeAssetProgressListener;
export const installCdnCacheInterceptor = () => {
  if (isInterceptorInstalled || typeof window === 'undefined' || !window.caches) return;
  isInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const shouldIntercept =
      url.includes('cdn.jsdelivr.net') ||
      url.includes('storage.googleapis.com') ||
      url.includes('cdnjs.cloudflare.com');

    if (!shouldIntercept) return originalFetch(input, init);

    try {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        notifyRuntimeAssetProgress(url, 100);
        return cachedResponse;
      }

      const response = await originalFetch(input, init);
      if (!response.ok) return response;

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (!response.body || contentLength <= 0) {
        await cache.put(url, response.clone());
        notifyRuntimeAssetProgress(url, 100);
        return response;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let loaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        loaded += value.length;
        notifyRuntimeAssetProgress(url, Math.min(100, Math.round((loaded / contentLength) * 100)));
      }

      const body = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.length;
      }

      const loadedResponse = new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      await cache.put(url, loadedResponse.clone());
      return loadedResponse;
    } catch (err) {
      console.warn(`CDN cache interceptor failed for ${url}; falling back to network.`, err);
      return originalFetch(input, init);
    }
  };
};

export const loadScriptWithCache = (src: string, options: LoadScriptOptions = {}) =>
  loadRuntimeAsset<void>({
    url: src,
    kind: 'script',
    label: options.label || src.split('/').pop() || src,
    version: options.version,
    fallbackUrls: options.fallbackUrls,
    sourceLabel: options.sourceLabel,
    expectedSha256: options.expectedSha256,
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    cache: true,
    onState: state => options.onStatus?.({
      src,
      label: state.label,
      status: state.status,
      attempt: state.attempt || 0,
      progress: state.progress,
      version: state.version,
      message: state.error,
      activeUrl: state.activeUrl,
      sourceLabel: state.sourceLabel,
      verified: state.verified,
    }),
  });
