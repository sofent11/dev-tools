import React, { useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../../ui/Button';
import {
  loadRuntimeAsset,
  type RuntimeAssetLoaderState,
  type RuntimeAssetOptions,
} from './runtimeAssetLoader';

const idleState = (options: RuntimeAssetOptions): RuntimeAssetLoaderState => ({
  status: 'idle',
  label: options.label,
  version: options.version,
  source: options.url,
});

export const useRuntimeAsset = <T,>(options: RuntimeAssetOptions) => {
  const [state, setState] = useState<RuntimeAssetLoaderState>(() => idleState(options));

  const load = useCallback(async () => {
    setState({ ...idleState(options), status: 'loading', progress: 0 });
    return loadRuntimeAsset<T>({
      ...options,
      onState: nextState => {
        setState(nextState);
        options.onState?.(nextState);
      },
    });
  }, [options]);

  const reset = useCallback(() => {
    setState(idleState(options));
  }, [options]);

  return {
    state,
    load,
    retry: load,
    reset,
  };
};

export const RuntimeAssetStatusPanel: React.FC<{
  state: RuntimeAssetLoaderState;
  onRetry?: () => void;
  compact?: boolean;
}> = ({ state, onRetry, compact = false }) => {
  if (state.status === 'idle' || state.status === 'ready') return null;

  const isError = state.status === 'error';
  const isCached = state.status === 'cached';
  const title = isError
    ? `${state.label} 加载失败`
    : isCached
      ? `${state.label} 命中本地缓存`
      : `正在加载 ${state.label}`;

  return (
    <div className={`${isError ? 'status-error' : 'status-info'} ${compact ? 'p-2 text-xs' : 'p-3 text-sm'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{title}</div>
          <div className="mt-1 break-all text-xs opacity-80">
            {state.version ? `版本 ${state.version} · ` : ''}
            {state.attempt ? `第 ${state.attempt} 次尝试 · ` : ''}
            {state.progress !== undefined ? `${state.progress}%` : ''}
          </div>
          {state.error && <div className="mt-1 text-xs">{state.error}</div>}
        </div>
        {isError && onRetry && (
          <Button size="xs" variant="secondary" onClick={onRetry} icon={<RefreshCw className="h-3.5 w-3.5" />}>
            重试
          </Button>
        )}
      </div>
      {!isError && state.progress !== undefined && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full bg-primary-500 transition-all" style={{ width: `${state.progress}%` }} />
        </div>
      )}
    </div>
  );
};
