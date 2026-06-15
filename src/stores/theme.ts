import { computed, ref, watchEffect } from 'vue'
import { defineStore } from 'pinia'

export type ThemePreference = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'croco-theme'

function readStored(): ThemePreference {
  const value = localStorage.getItem(STORAGE_KEY)
  // Default to light: the design is tuned to shine in the light theme first.
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'light'
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = defineStore('theme', () => {
  // The user's choice; `system` follows the OS preference live.
  const preference = ref<ThemePreference>(readStored())
  // Tracks the OS preference so `system` re-resolves when the OS flips.
  const systemDark = ref(systemPrefersDark())

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', (e) => {
    systemDark.value = e.matches
  })

  const resolved = computed<ResolvedTheme>(() => {
    if (preference.value === 'system') {
      return systemDark.value ? 'dark' : 'light'
    }
    return preference.value
  })

  // Reflect the resolved theme onto <html> so tokens.css can react, and persist.
  watchEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved.value)
    localStorage.setItem(STORAGE_KEY, preference.value)
  })

  function setTheme(value: ThemePreference) {
    preference.value = value
  }

  // Quick toggle between the two visible themes (ignores `system`).
  function toggle() {
    preference.value = resolved.value === 'dark' ? 'light' : 'dark'
  }

  return { preference, resolved, setTheme, toggle }
})
