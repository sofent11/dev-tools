export interface RuntimeAssetLoaderState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  label: string;
  version?: string;
  source?: string;
  error?: string;
}

const moduleCache = new Map<string, Promise<unknown>>();
const scriptCache = new Map<string, Promise<void>>();

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, label: string) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} 加载超时，请检查网络后重试。`)), timeoutMs);
    }),
  ]);

export const loadRemoteModule = <T,>(url: string, label: string, timeoutMs = 15000) => {
  if (!moduleCache.has(url)) {
    moduleCache.set(
      url,
      withTimeout(import(/* @vite-ignore */ url), timeoutMs, label),
    );
  }
  return moduleCache.get(url) as Promise<T>;
};

export const loadRemoteScript = (url: string, label: string, timeoutMs = 15000) => {
  if (!scriptCache.has(url)) {
    scriptCache.set(url, withTimeout(new Promise<void>((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-runtime-src]'))
        .find(scriptNode => scriptNode.dataset.runtimeSrc === url);
      if (existing?.dataset.loaded === 'true') {
        resolve();
        return;
      }

      const script = existing || document.createElement('script');
      script.src = url;
      script.async = true;
      script.dataset.runtimeSrc = url;
      script.onload = () => {
        script.dataset.loaded = 'true';
        resolve();
      };
      script.onerror = () => reject(new Error(`${label} 加载失败。`));
      if (!existing) document.body.appendChild(script);
    }), timeoutMs, label));
  }
  return scriptCache.get(url)!;
};
