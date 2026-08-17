import type { Lang } from '../types'

/**
 * The app is translated into Korean and English only, so a Korean desktop gets
 * Korean and every other language falls back to English.
 */
export function langOfLocale(locale: string | null | undefined): Lang {
  return typeof locale === 'string' && locale.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

/**
 * The desktop's own language, used until the user picks one in Settings.
 * Inside Electron `navigator` reports the locale the OS launched the app with.
 */
export function systemLang(): Lang {
  if (typeof navigator === 'undefined') return 'en'
  return langOfLocale(navigator.languages?.[0] ?? navigator.language)
}
