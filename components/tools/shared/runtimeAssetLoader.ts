const CACHE_NAME = 'devtoolbox-runtime-assets-cache';

export type RuntimeAssetKind = 'script' | 'module' | 'asset';
export type RuntimeAssetStatus = 'idle' | 'loading' | 'cached' | 'ready' | 'error';

export interface RuntimeAssetLoaderState {
  status: RuntimeAssetStatus;
  label: string;
  version?: string;
  source?: string;
  activeUrl?: string;
  sourceLabel?: string;
  cached?: boolean;
  attempt?: number;
  progress?: number;
  error?: string;
  verified?: boolean;
}

export interface RuntimeAssetOptions {
  url: string;
  fallbackUrls?: string[];
  kind: RuntimeAssetKind;
  label: string;
  version?: string;
  sourceLabel?: string;
  expectedSha256?: string;
  timeoutMs?: number;
  retries?: number;
  cache?: boolean;
  onState?: (state: RuntimeAssetLoaderState) => void;
}

const moduleCache = new Map<string, Promise<unknown>>();
const scriptCache = new Map<string, Promise<void>>();
const progressListeners = new Map<string, (progress: number) => void>();

const emit = (
  options: RuntimeAssetOptions,
  state: Omit<RuntimeAssetLoaderState, 'label' | 'version' | 'source'>,
  activeUrl = options.url,
) => {
  options.onState?.({
    label: options.label,
    version: options.version,
    source: options.url,
    activeUrl,
    sourceLabel: options.sourceLabel,
    ...state,
  });
};

const delay = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

const withRuntimeTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string) => {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(`${label} 加载超时，请检查网络后重试。`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

const getRuntimeCache = async () => {
  if (typeof window === 'undefined' || !window.caches) return undefined;
  return caches.open(CACHE_NAME);
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

const normalizeSha256 = (value: string) => value.trim().toLowerCase().replace(/^sha256-/, '');

const verifyResponseSha256 = async (response: Response, expectedSha256?: string) => {
  if (!expectedSha256) return { response, verified: undefined };
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前浏览器不支持 SHA-256 资源校验。');
  }

  const bytes = await response.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const actual = toHex(digest);
  const expected = normalizeSha256(expectedSha256);
  if (actual !== expected) {
    throw new Error(`资源完整性校验失败：期望 ${expected}，实际 ${actual}`);
  }

  return {
    response: new Response(bytes, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
    verified: true,
  };
};

const getCandidateUrls = (options: RuntimeAssetOptions) =>
  Array.from(new Set([options.url, ...(options.fallbackUrls ?? [])].filter(Boolean)));

const fetchWithProgress = async (options: RuntimeAssetOptions, attempt: number, activeUrl = options.url) => {
  const timeoutMs = options.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const cache = options.cache === false ? undefined : await getRuntimeCache();
    const cachedResponse = await cache?.match(activeUrl);
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers);
      headers.set('x-devtoolbox-runtime-cache', 'hit');
      const cachedCopy = new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
      const verified = await verifyResponseSha256(cachedCopy, options.expectedSha256);
      emit(options, { status: 'cached', cached: true, attempt, progress: 100, verified: Boolean(options.expectedSha256) }, activeUrl);
      return verified.response;
    }

    emit(options, { status: 'loading', cached: false, attempt, progress: 0 }, activeUrl);
    const response = await window.fetch(activeUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (!response.body || contentLength <= 0) {
      const verified = await verifyResponseSha256(response, options.expectedSha256);
      await cache?.put(activeUrl, verified.response.clone());
      return verified.response;
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
      const progress = Math.min(100, Math.round((loaded / contentLength) * 100));
      emit(options, { status: 'loading', cached: false, attempt, progress }, activeUrl);
      for (const [key, listener] of progressListeners.entries()) {
        if (activeUrl.includes(key)) listener(progress);
      }
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
    const verified = await verifyResponseSha256(loadedResponse, options.expectedSha256);
    await cache?.put(activeUrl, verified.response.clone());
    return verified.response;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const executeScriptText = (code: string, options: RuntimeAssetOptions, attempt: number, activeUrl = options.url) => new Promise<void>((resolve, reject) => {
  const existing = Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-runtime-src]'))
    .find(scriptNode => scriptNode.dataset.runtimeSrc === activeUrl);
  if (existing?.dataset.loaded === 'true') {
    emit(options, { status: 'ready', cached: true, attempt, progress: 100, verified: Boolean(options.expectedSha256) }, activeUrl);
    resolve();
    return;
  }

  const blobUrl = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
  const script = existing || document.createElement('script');
  const cleanup = () => {
    window.clearTimeout(timeoutId);
    URL.revokeObjectURL(blobUrl);
  };
  const timeoutId = window.setTimeout(() => {
    cleanup();
    if (!existing) script.remove();
    reject(new Error(`${options.label} 执行超时，请检查网络后重试。`));
  }, options.timeoutMs ?? 15000);

  script.src = blobUrl;
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.dataset.runtimeSrc = activeUrl;
  script.onload = () => {
    cleanup();
    script.dataset.loaded = 'true';
    emit(options, { status: 'ready', cached: false, attempt, progress: 100, verified: Boolean(options.expectedSha256) }, activeUrl);
    resolve();
  };
  script.onerror = () => {
    cleanup();
    if (!existing) script.remove();
    reject(new Error(`${options.label} 执行失败。`));
  };
  if (!existing) document.head.appendChild(script);
});

const loadScriptAsset = async (options: RuntimeAssetOptions) => {
  if (typeof document === 'undefined') return;
  const candidateUrls = getCandidateUrls(options);
  const existing = Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-runtime-src],script[data-src]'))
    .find(scriptNode => candidateUrls.includes(scriptNode.dataset.runtimeSrc || '') || candidateUrls.includes(scriptNode.dataset.src || ''));
  const existingUrl = existing?.dataset.runtimeSrc || existing?.dataset.src || options.url;
  if (existing?.dataset.loaded === 'true' || candidateUrls.includes(existing?.dataset.src || '')) {
    emit(options, { status: 'ready', cached: true, attempt: 0, progress: 100, verified: Boolean(options.expectedSha256) }, existingUrl);
    return;
  }

  const attempts = Math.max(1, (options.retries ?? 1) + 1);
  let lastError: unknown;

  for (const activeUrl of candidateUrls) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetchWithProgress(options, attempt, activeUrl);
        const code = await response.text();
        await executeScriptText(code, options, attempt, activeUrl);
        return;
      } catch (err) {
        lastError = err;
        emit(options, { status: 'error', attempt, error: (err as Error).message }, activeUrl);
        if (attempt < attempts) await delay(400 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${options.label} 加载失败。`);
};

const loadRawAsset = async (options: RuntimeAssetOptions) => {
  const attempts = Math.max(1, (options.retries ?? 1) + 1);
  const candidateUrls = getCandidateUrls(options);
  let lastError: unknown;

  for (const activeUrl of candidateUrls) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        const response = await fetchWithProgress(options, attempt, activeUrl);
        emit(options, {
          status: 'ready',
          cached: response.headers.get('x-devtoolbox-runtime-cache') === 'hit',
          attempt,
          progress: 100,
          verified: Boolean(options.expectedSha256),
        }, activeUrl);
        return response;
      } catch (err) {
        lastError = err;
        emit(options, { status: 'error', attempt, error: (err as Error).message }, activeUrl);
        if (attempt < attempts) await delay(400 * attempt);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${options.label} 加载失败。`);
};

export const loadRuntimeAsset = async <T = unknown>(options: RuntimeAssetOptions): Promise<T> => {
  if (options.kind === 'module') {
    if (!moduleCache.has(options.url)) {
      const promise = (async () => {
        const attempts = Math.max(1, (options.retries ?? 0) + 1);
        const candidateUrls = getCandidateUrls(options);
        let lastError: unknown;

        for (const activeUrl of candidateUrls) {
          for (let attempt = 1; attempt <= attempts; attempt += 1) {
            emit(options, { status: 'loading', attempt, progress: 0 }, activeUrl);
            try {
              const module = await withRuntimeTimeout(
                import(/* @vite-ignore */ activeUrl),
                options.timeoutMs ?? 15000,
                options.label,
              );
              emit(options, { status: 'ready', attempt, progress: 100 }, activeUrl);
              return module;
            } catch (err) {
              lastError = err;
              emit(options, { status: 'error', attempt, error: (err as Error).message }, activeUrl);
              if (attempt < attempts) await delay(400 * attempt);
            }
          }
        }

        moduleCache.delete(options.url);
        throw lastError instanceof Error ? lastError : new Error(`${options.label} 加载失败。`);
      })();
      moduleCache.set(options.url, promise);
    }
    return moduleCache.get(options.url) as Promise<T>;
  }

  if (options.kind === 'asset') {
    return loadRawAsset(options) as Promise<T>;
  }

  if (!scriptCache.has(options.url)) {
    const promise = loadScriptAsset(options).catch(err => {
      scriptCache.delete(options.url);
      throw err;
    });
    scriptCache.set(options.url, promise);
  }
  await scriptCache.get(options.url);
  return undefined as T;
};

export const loadRemoteModule = <T,>(url: string, label: string, timeoutMs = 15000) =>
  loadRuntimeAsset<T>({ url, kind: 'module', label, timeoutMs, cache: false });

export const loadRemoteScript = (url: string, label: string, timeoutMs = 15000) =>
  loadRuntimeAsset<void>({ url, kind: 'script', label, timeoutMs, retries: 1, cache: true });

export const registerRuntimeAssetProgressListener = (urlSubstr: string, cb: (progress: number) => void) => {
  progressListeners.set(urlSubstr, cb);
};

export const unregisterRuntimeAssetProgressListener = (urlSubstr: string) => {
  progressListeners.delete(urlSubstr);
};

export const notifyRuntimeAssetProgress = (url: string, progress: number) => {
  for (const [key, listener] of progressListeners.entries()) {
    if (url.includes(key)) listener(progress);
  }
};

export const __runtimeAssetLoaderTestUtils = {
  clearCaches: () => {
    moduleCache.clear();
    scriptCache.clear();
    progressListeners.clear();
  },
  withRuntimeTimeout,
};
