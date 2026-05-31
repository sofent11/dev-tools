const CACHE_NAME = 'devtoolbox-models-cache';
type ProgressCallback = (progress: number) => void;

const listeners = new Map<string, ProgressCallback>();
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

export const loadScriptWithCache = async (src: string): Promise<void> => {
  if (typeof document === 'undefined') return;
  
  // Install interceptor just in case it is not already
  installCdnCacheInterceptor();

  if (document.querySelector(`script[data-src="${src}"]`)) {
    return;
  }

  const response = await window.fetch(src);
  const text = await response.text();
  const blob = new Blob([text], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = blobUrl;
    script.setAttribute('data-src', src);
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      URL.revokeObjectURL(blobUrl);
      resolve();
    };
    script.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error(`Failed to load cached script: ${src}`));
    };
    document.head.appendChild(script);
  });
};
