import { notifyToast } from './notifyToast';
import { useCallback, useState } from 'react';

export const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); } catch (error) {
      notifyToast({ title: '复制失败', description: (error as Error).message, tone: 'error' });
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, []);

  return { copied, copy };
};
