import { useCallback, useState } from 'react';

export const useCopyToClipboard = () => {
  const [copied, setCopied] = useState(false);

  const copy = useCallback((text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, []);

  return { copied, copy };
};
