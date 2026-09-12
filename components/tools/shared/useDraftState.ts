import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
// Session-only, bounded drafts. Never retain files, models, DOM nodes or worker handles.
const drafts = new Map<string, { value: unknown; bytes: number }>();
let totalBytes = 0;
const remember = (key: string, value: unknown) => {
  let serialized: string;
  try { serialized = JSON.stringify(value); } catch { return; }
  if (!serialized || serialized.length > 1_000_000) return;
  const previous = drafts.get(key);
  totalBytes -= previous?.bytes || 0;
  drafts.delete(key);
  drafts.set(key, { value, bytes: serialized.length * 2 });
  totalBytes += serialized.length * 2;
  while (totalBytes > 8_000_000 || drafts.size > 300) {
    const oldest = drafts.keys().next().value;
    if (!oldest) break;
    totalBytes -= drafts.get(oldest)!.bytes;
    drafts.delete(oldest);
  }
};
export function useDraftState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => drafts.has(key) ? drafts.get(key)!.value as T : typeof initial === 'function' ? (initial as () => T)() : initial);
  const update = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setValue(previous => {
      const next = typeof action === 'function' ? (action as (previous: T) => T)(previous) : action;
      remember(key, next);
      return next;
    });
  }, [key]);
  return [value, update];
}
