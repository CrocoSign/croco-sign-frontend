import { test, expect } from '@playwright/test'

// See here how to get started:
// https://playwright.dev/docs/intro
test('root redirects to the translate page', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/translate$/)
  await expect(page.locator('h1')).toHaveText('PJM Sign Language Translation')
  await expect(page.locator('select')).toBeVisible()
})
