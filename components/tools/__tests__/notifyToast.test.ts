import { describe, expect, it, vi } from 'vitest';
import { notifyToast } from '../shared/notifyToast';

describe('notifyToast', () => {
  it('dispatches optional action payloads', () => {
    const onAction = vi.fn();
    const listener = vi.fn();
    window.addEventListener('devtoolbox-toast', listener);

    notifyToast({
      title: '暂存箱保存失败',
      description: 'quota exceeded',
      tone: 'error',
      actionLabel: '下载本地文件',
      onAction,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      title: '暂存箱保存失败',
      description: 'quota exceeded',
      tone: 'error',
      actionLabel: '下载本地文件',
      onAction,
    });

    window.removeEventListener('devtoolbox-toast', listener);
  });
});
