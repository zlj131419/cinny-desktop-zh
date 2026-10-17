import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend, { HttpBackendOptions } from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';
import { trimTrailingSlash } from './utils/common';

// list of namespaces
export const NAMESPACES = [
  'components',
  'features',
  'pages',
  'hooks',
  'util'
] as const;

// list of supported languages
export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文 (简体)' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch' }
] as const;

// 硬默认中文：只认 localStorage 里用户显式存过的，否则一律 zh-CN
const getInitialLng = (): string => {
  try {
    const saved = localStorage.getItem('i18nextLng');
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch { /* ignore */ }
  return 'zh-CN';
};

i18n
  // i18next-http-backend
  // loads translations from your server
  // https://github.com/i18next/i18next-http-backend
  .use(Backend)
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use(LanguageDetector)
  // pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init<HttpBackendOptions>({
    debug: false,
    lng: getInitialLng(),
    fallbackLng: 'zh-CN',
    supportedLngs: SUPPORTED_LANGUAGES.map(lang => lang.code),
    ns: NAMESPACES,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    backend: {
      loadPath: `${trimTrailingSlash(import.meta.env.BASE_URL)}/public/locales/{{lng}}/{{ns}}.json`,
    },
    detection: {
      // 只用用户显式选择（localStorage），默认中文简体，不跟随浏览器语言
      order: ['localStorage'],
      caches: ['localStorage'],
    },
  });

export default i18n;
