import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from './provider';
import { translateUi as tr, useLocaleRender } from './render';
import { useI18n } from './index';

let root: Root;
let host: HTMLDivElement;
const settle = () => new Promise(resolve => setTimeout(resolve, 40));
const Harness = ({ label, payload = '复制' }: { label: string; payload?: string }) => {
  useLocaleRender();
  const { toggleLocale } = useI18n();
  return <main><button onClick={toggleLocale} aria-label={tr(label)}>{tr(label)}</button><select><option>{tr(label)}</option></select><span data-i18n-skip>{payload}</span></main>;
};

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const storage = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), clear: () => storage.clear() } });
  window.localStorage.setItem('locale', 'en-US');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); window.localStorage.clear(); });

describe('Explicit UI localization after interactive changes', () => {
  it('translates updated reused nodes and restores the current source on a locale switch', async () => {
    await act(async () => { root.render(<I18nProvider><Harness label="复制" /></I18nProvider>); });
    await settle();
    expect(host.querySelector('button')?.textContent).toBe('Copy');
    await act(async () => { root.render(<I18nProvider><Harness label="下载" /></I18nProvider>); });
    await settle();
    expect(host.querySelector('button')?.textContent).toBe('Download');
    expect(host.querySelector('button')?.getAttribute('aria-label')).toBe('Download');
    expect(host.querySelector('option')?.textContent).toBe('Download');
    await act(async () => { host.querySelector('button')?.click(); });
    await settle();
    expect(host.querySelector('button')?.textContent).toBe('下载');
    expect(host.querySelector('option')?.textContent).toBe('下载');
  });
  it('keeps new Latin results and user content intact', async () => {
    await act(async () => { root.render(<I18nProvider><Harness label="复制" /></I18nProvider>); });
    await settle();
    await act(async () => { root.render(<I18nProvider><Harness label="EXE" payload="下载" /></I18nProvider>); });
    await settle();
    expect(host.querySelector('button')?.textContent).toBe('EXE');
    expect(host.querySelector('button')?.getAttribute('aria-label')).toBe('EXE');
    expect(host.querySelector('option')?.textContent).toBe('EXE');
    expect(host.querySelector('[data-i18n-skip]')?.textContent).toBe('下载');
  });
});
