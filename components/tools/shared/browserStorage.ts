export const readPreference = (key: string): string | null => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
export const writePreference = (key: string, value: string | null) => {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); }
  catch { /* Preferences still apply for this session when storage is unavailable. */ }
};
