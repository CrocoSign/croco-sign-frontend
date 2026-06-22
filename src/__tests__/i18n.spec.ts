import { describe, it, expect, afterEach } from 'vitest'

import i18n, { setLocale } from '@/i18n'
import { localizeModelName, localizeTransferSource } from '@/i18n/dataLabels'

afterEach(() => {
  // Restore the suite-wide default.
  i18n.global.locale.value = 'en'
})

describe('dataLabels', () => {
  it('localizes a known transfer source', () => {
    expect(localizeTransferSource('brak (od zera)', 'en')).toBe('none (from scratch)')
    expect(localizeTransferSource('brak (od zera)', 'pl')).toBe('brak (od zera)')
    expect(localizeTransferSource('brak (tylko PJM)', 'en')).toBe('none (PJM only)')
  })

  it('localizes a known model name', () => {
    expect(localizeModelName('SpaMo (modyf.)', 'en')).toBe('SpaMo (mod.)')
    expect(localizeModelName('SpaMo (modyf.)', 'pl')).toBe('SpaMo (modyf.)')
  })

  it('passes proper nouns / unknown values through unchanged', () => {
    expect(localizeTransferSource('PHOENIX', 'en')).toBe('PHOENIX')
    expect(localizeTransferSource('OpenASL', 'pl')).toBe('OpenASL')
    expect(localizeModelName('Uni-Sign', 'en')).toBe('Uni-Sign')
  })
})

describe('setLocale', () => {
  it('updates the i18n locale, persists it and sets <html lang>', () => {
    setLocale('pl')
    expect(i18n.global.locale.value).toBe('pl')
    expect(localStorage.getItem('croco-lang')).toBe('pl')
    expect(document.documentElement.getAttribute('lang')).toBe('pl')

    setLocale('en')
    expect(i18n.global.locale.value).toBe('en')
    expect(localStorage.getItem('croco-lang')).toBe('en')
    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })

  it('translates keys and falls back to English for the active locale', () => {
    setLocale('en')
    expect(i18n.global.t('common.retry')).toBe('Retry')
    setLocale('pl')
    expect(i18n.global.t('nav.translate')).not.toBe('nav.translate') // a real Polish string
  })
})
