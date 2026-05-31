import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LOCALE, LOCALES, type Locale, translateText } from './messages';
import { I18nContext, type I18nContextValue } from './context';

const textNodeOriginals = new WeakMap<Text, string>();
const elementAttributeOriginals = new WeakMap<Element, Map<string, string>>();
const TRANSLATABLE_ATTRIBUTES = ['aria-label', 'aria-valuetext', 'placeholder', 'title'];
const SKIP_SELECTOR = [
  '[data-i18n-skip]',
  'script',
  'style',
  'noscript',
  'code',
  'pre',
  'kbd',
  'samp',
  'canvas',
  'svg',
  'textarea',
  'input',
  '[contenteditable="true"]',
].join(',');

const hasHan = (value: string) => /[\p{Script=Han}]/u.test(value);

const isLocale = (value: string | null): value is Locale =>
  LOCALES.some(locale => locale.code === value);

const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem('locale');
  if (isLocale(stored)) return stored;
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US';
};

const shouldSkipElement = (element: Element | null) =>
  Boolean(element?.closest(SKIP_SELECTOR));

const localizeTextNode = (node: Text, locale: Locale) => {
  const parent = node.parentElement;
  if (!parent || shouldSkipElement(parent)) return;
  if (locale === 'zh-CN' && hasHan(node.data)) {
    textNodeOriginals.set(node, node.data);
    return;
  }

  const existingOriginal = textNodeOriginals.get(node);
  const original = existingOriginal ?? node.data;
  if (!hasHan(original)) return;

  if (!existingOriginal) {
    textNodeOriginals.set(node, original);
  }

  const next = locale === 'zh-CN' ? original : translateText(original, locale);
  if (node.data !== next) node.data = next;
};

const localizeElementAttributes = (element: Element, locale: Locale) => {
  if (shouldSkipElement(element)) return;

  for (const attr of TRANSLATABLE_ATTRIBUTES) {
    const value = element.getAttribute(attr);
    const originals = elementAttributeOriginals.get(element);
    const original = originals?.get(attr) ?? value;
    if (!original) continue;

    if (locale === 'zh-CN' && hasHan(value)) {
      const nextOriginals = originals ?? new Map<string, string>();
      nextOriginals.set(attr, value);
      elementAttributeOriginals.set(element, nextOriginals);
      continue;
    }

    if (!hasHan(original)) continue;

    if (!originals?.has(attr)) {
      const nextOriginals = originals ?? new Map<string, string>();
      nextOriginals.set(attr, original);
      elementAttributeOriginals.set(element, nextOriginals);
    }

    const next = locale === 'zh-CN' ? original : translateText(original, locale);
    if (value !== next) element.setAttribute(attr, next);
  }
};

const walkAndLocalize = (root: ParentNode, locale: Locale) => {
  if (root instanceof Element) localizeElementAttributes(root, locale);

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      localizeTextNode(current as Text, locale);
    } else if (current instanceof Element) {
      localizeElementAttributes(current, locale);
    }
    current = walker.nextNode();
  }
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem('locale', nextLocale);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN');
  }, [locale, setLocale]);

  const t = useCallback((value: string) => translateText(value, locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;

    const localize = () => walkAndLocalize(document.body, locale);
    localize();

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target instanceof Text) {
          localizeTextNode(mutation.target, locale);
        }
        mutation.addedNodes.forEach(node => {
          if (node instanceof Text) localizeTextNode(node, locale);
          if (node instanceof Element) walkAndLocalize(node, locale);
        });
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          localizeElementAttributes(mutation.target, locale);
        }
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [locale]);

  useEffect(() => {
    const originalAlert = window.alert;
    const originalConfirm = window.confirm;

    window.alert = (message?: unknown) => {
      originalAlert(translateText(String(message ?? ''), locale));
    };
    window.confirm = (message?: string) => originalConfirm(translateText(String(message ?? ''), locale));

    return () => {
      window.alert = originalAlert;
      window.confirm = originalConfirm;
    };
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
