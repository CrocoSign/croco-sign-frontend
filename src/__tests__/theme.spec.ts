import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

import { useThemeStore } from '@/stores/theme'

// A controllable matchMedia: tests set `mqMatches` before creating the store and
// can fire the captured `change` handler to simulate an OS theme flip.
let mqMatches = false
let changeHandler: ((e: { matches: boolean }) => void) | null = null

beforeEach(() => {
  localStorage.clear()
  mqMatches = false
  changeHandler = null
  document.documentElement.removeAttribute('data-theme')
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: mqMatches,
      media: query,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => {
        changeHandler = cb
      },
      removeEventListener: () => {},
    })),
  )
  setActivePinia(createPinia())
})

describe('theme store', () => {
  it('defaults to light when nothing valid is stored', () => {
    const store = useThemeStore()
    expect(store.preference).toBe('light')
    expect(store.resolved).toBe('light')
  })

  it('reads a valid stored preference', () => {
    localStorage.setItem('croco-theme', 'dark')
    const store = useThemeStore()
    expect(store.preference).toBe('dark')
    expect(store.resolved).toBe('dark')
  })

  it('resolves "system" from the OS preference', () => {
    localStorage.setItem('croco-theme', 'system')
    mqMatches = true
    const store = useThemeStore()
    expect(store.preference).toBe('system')
    expect(store.resolved).toBe('dark')
  })

  it('setTheme updates the preference', () => {
    const store = useThemeStore()
    store.setTheme('dark')
    expect(store.resolved).toBe('dark')
  })

  it('toggle flips between light and dark (even from system)', () => {
    localStorage.setItem('croco-theme', 'system')
    mqMatches = false // resolves to light
    const store = useThemeStore()
    store.toggle()
    expect(store.preference).toBe('dark')
    store.toggle()
    expect(store.preference).toBe('light')
  })

  it('reflects the resolved theme onto <html> and persists it', async () => {
    const store = useThemeStore()
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('croco-theme')).toBe('light')

    store.setTheme('dark')
    await nextTick()
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem('croco-theme')).toBe('dark')
  })

  it('reacts to an OS theme change when following system', async () => {
    localStorage.setItem('croco-theme', 'system')
    mqMatches = false
    const store = useThemeStore()
    expect(store.resolved).toBe('light')

    changeHandler?.({ matches: true })
    await nextTick()
    expect(store.resolved).toBe('dark')
  })
})
