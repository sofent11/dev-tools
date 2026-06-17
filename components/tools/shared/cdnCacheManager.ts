import {
  loadRuntimeAsset,
  registerRuntimeAssetProgressListener,
  unregisterRuntimeAssetProgressListener,
  type RuntimeAssetLoaderState,
} from './runtimeAssetLoader';

const CACHE_NAME = 'devtoolbox-runtime-assets-cache';

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
  if (typeof window === 'undefined' || !window.caches) return;
  void caches.open(CACHE_NAME);
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
