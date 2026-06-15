import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import pl from './locales/pl.json'

export type AppLocale = 'pl' | 'en'

const STORAGE_KEY = 'croco-lang'

function initialLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'pl' || stored === 'en' ? stored : 'pl'
}

const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { pl, en },
})

// Keep <html lang> in sync from the start.
document.documentElement.setAttribute('lang', i18n.global.locale.value)

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale
  localStorage.setItem(STORAGE_KEY, locale)
  document.documentElement.setAttribute('lang', locale)
}

export default i18n
