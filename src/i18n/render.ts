import { useContext } from 'react';
import { I18nContext } from './context';
import { DEFAULT_LOCALE, translateText, type Locale } from './messages';
let renderLocale: Locale = DEFAULT_LOCALE;
export const setRenderLocale = (locale: Locale) => { renderLocale = locale; };
/** Only interface strings enter this function; editor contents and results are never traversed. */
export const translateUi = <T,>(value: T): T => typeof value === 'string' ? translateText(value, renderLocale) as T : value;
export const useLocaleRender = () => { useContext(I18nContext); };
