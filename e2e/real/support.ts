import type { Page } from '@playwright/test'

// Pin language + theme before app code runs so copy/colours are deterministic
// regardless of stored preferences. (The app otherwise defaults to Polish.)
export async function usePreferences(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('croco-lang', 'en')
    localStorage.setItem('croco-theme', 'light')
  })
}

// A minimal real mp4 header — enough to be accepted as a video upload.
export const fakeVideo = {
  name: 'clip.mp4',
  mimeType: 'video/mp4',
  buffer: Buffer.from('00000018667479706d703432', 'hex'),
}
