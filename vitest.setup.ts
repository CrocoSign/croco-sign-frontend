import { config } from '@vue/test-utils'
import i18n from '@/i18n'

// The app defaults to Polish, but the tests assert against English copy.
// Pin the locale so component text is deterministic across the suite.
i18n.global.locale.value = 'en'

// Components call useI18n(); make the i18n plugin available to every mounted
// component so tests don't each have to register it explicitly.
config.global.plugins = [...(config.global.plugins ?? []), i18n]

// jsdom doesn't implement matchMedia, which the theme store reads at creation.
// Provide a light-theme default; tests that exercise the media listener override
// this via vi.stubGlobal.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
