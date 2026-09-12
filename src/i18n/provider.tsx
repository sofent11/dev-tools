import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, LOCALES, type Locale, translateText } from './messages';
import { I18nContext } from './context';
import { readPreference, writePreference } from '../../components/tools/shared/browserStorage';
import { setRenderLocale } from './render';
const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = readPreference('locale');
  if (LOCALES.some(locale => locale.code === stored)) return stored as Locale;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
};
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  setRenderLocale(locale);
  const setLocale = useCallback((next: Locale) => { setLocaleState(next); writePreference('locale', next); }, []);
  const toggleLocale = useCallback(() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN'), [locale, setLocale]);
  const t = useCallback((value: string) => translateText(value, locale), [locale]);
  useEffect(() => { document.documentElement.lang = locale; document.documentElement.dataset.locale = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, toggleLocale, t }), [locale, setLocale, toggleLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
