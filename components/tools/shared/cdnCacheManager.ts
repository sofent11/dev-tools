const CACHE_NAME = 'devtoolbox-models-cache';
type ProgressCallback = (progress: number) => void;
export type RemoteRuntimeStatus = 'idle' | 'loading' | 'cached' | 'ready' | 'error';
export type RemoteRuntimeEvent = {
  src: string;
  label: string;
  status: RemoteRuntimeStatus;
  attempt: number;
  progress?: number;
  version?: string;
  message?: string;
};

export interface LoadScriptOptions {
  label?: string;
  version?: string;
  timeoutMs?: number;
  retries?: number;
  onStatus?: (event: RemoteRuntimeEvent) => void;
}

const listeners = new Map<string, ProgressCallback>();
const scriptPromises = new Map<string, Promise<void>>();
let isInterceptorInstalled = false;

export const registerCacheProgressListener = (urlSubstr: string, cb: ProgressCallback) => {
  listeners.set(urlSubstr, cb);
};

export const unregisterCacheProgressListener = (urlSubstr: string) => {
  listeners.delete(urlSubstr);
};

export const installCdnCacheInterceptor = () => {
  if (isInterceptorInstalled || typeof window === 'undefined' || !window.caches) return;
  isInterceptorInstalled = true;

  const originalFetch = window.fetch;

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input as Request).url;

    // Intercept major developer CDN domains to make models completely offline-resilient
    const shouldIntercept =
      url.includes('cdn.jsdelivr.net') ||
      url.includes('storage.googleapis.com') ||
      url.includes('cdnjs.cloudflare.com');

    if (!shouldIntercept) {
      return originalFetch(input, init);
    }

    try {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(url);
      if (cachedResponse) {
        // Trigger 100% progress for any matching listeners
        for (const [key, cb] of listeners.entries()) {
          if (url.includes(key)) {
            cb(100);
          }
        }
        return cachedResponse;
      }

      // Fetch from network with progress tracking
      const response = await originalFetch(input, init);
      if (!response.ok) return response;

      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      if (total === 0 || !response.body) {
        // If content-length is missing, clone and cache normally
        const cloned = response.clone();
        await cache.put(url, cloned);
        return response;
      }

      // Read chunks from response body to calculate percentage progress
      const reader = response.body.getReader();
      let loaded = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          const percent = Math.round((loaded / total) * 100);
          // Broadcast progress update to registered listeners
          for (const [key, cb] of listeners.entries()) {
            if (url.includes(key)) {
              cb(percent);
            }
          }
        }
      }

      // Combine chunks back into a single Uint8Array
      const combined = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const newResponse = new Response(combined, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });

      // Put cloned response in Cache storage
      await cache.put(url, newResponse.clone());
      return newResponse;
    } catch (err) {
      console.warn(`CDN Cache interceptor failed for: ${url}. Falling back to default fetch.`, err);
      return originalFetch(input, init);
    }
  };
};

const fetchWithTimeout = async (src: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await window.fetch(src, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const getCachedResponse = async (src: string) => {
  if (typeof window === 'undefined' || !window.caches) return undefined;
  const cache = await caches.open(CACHE_NAME);
  return cache.match(src);
};

const emitRuntimeStatus = (
  src: string,
  options: LoadScriptOptions,
  status: RemoteRuntimeStatus,
  attempt: number,
  message?: string,
) => {
  options.onStatus?.({
    src,
    status,
    attempt,
    message,
    version: options.version,
    label: options.label || src.split('/').pop() || src,
  });
};

export const loadScriptWithCache = async (src: string, options: LoadScriptOptions = {}): Promise<void> => {
  if (typeof document === 'undefined') return;
  
  // Install interceptor just in case it is not already
  installCdnCacheInterceptor();

  if (document.querySelector(`script[data-src="${src}"]`)) {
    emitRuntimeStatus(src, options, 'ready', 0, '运行时已加载');
    return;
  }

  const existing = scriptPromises.get(src);
  if (existing) return existing;

  const promise = (async () => {
    const maxAttempts = Math.max(1, (options.retries ?? 1) + 1);
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const cached = await getCachedResponse(src);
        emitRuntimeStatus(
          src,
          options,
          cached ? 'cached' : 'loading',
          attempt,
          cached ? '命中本地缓存，正在装载运行时' : `正在加载远程运行时 (${attempt}/${maxAttempts})`,
        );

        const response = cached || await fetchWithTimeout(src, options.timeoutMs ?? 15000);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        const blob = new Blob([text], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = blobUrl;
          script.setAttribute('data-src', src);
          script.crossOrigin = 'anonymous';
          script.onload = () => {
            URL.revokeObjectURL(blobUrl);
            emitRuntimeStatus(src, options, 'ready', attempt, '运行时加载完成');
            resolve();
          };
          script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            script.remove();
            reject(new Error(`Failed to execute cached script: ${src}`));
          };
          document.head.appendChild(script);
        });
        return;
      } catch (err) {
        lastError = err;
        emitRuntimeStatus(src, options, 'error', attempt, (err as Error).message);
        if (attempt < maxAttempts) {
          await new Promise(resolve => window.setTimeout(resolve, 500 * attempt));
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to load runtime: ${src}`);
  })();

  scriptPromises.set(src, promise);
  try {
    await promise;
  } catch (err) {
    scriptPromises.delete(src);
    throw err;
  }
};
