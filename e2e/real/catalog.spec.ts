import { test, expect } from '@playwright/test'
import { usePreferences } from './support'

// These hit the REAL backend on :8000. The data is real, so assertions are
// structural (rows exist, navigation works) rather than exact-value.

test.beforeEach(async ({ page }) => {
  await usePreferences(page)
})

test('segments list loads from the corpus and a row opens its detail', async ({ page }) => {
  await page.goto('/view')

  // The list reads the real SQLite-backed catalog (tens of thousands of rows).
  const rows = page.locator('tbody tr.row')
  await expect(rows.first()).toBeVisible()
  await expect(page.locator('.count')).toContainText('of')
  await expect(page.locator('input[type="checkbox"]').first()).toBeVisible()

  // Capture the first row's clip key, then open it.
  await rows.first().click()
  await expect(page).toHaveURL(/\/view\/\d+$/)

  // Detail page renders the segment id, sentence and a video element (clip streamed from HF).
  await expect(page.locator('h1')).not.toBeEmpty()
  await expect(page.locator('.sentence')).toBeVisible()
  await expect(page.locator('video.player')).toBeVisible()

  await page.getByRole('link', { name: /Back to segments/ }).click()
  await expect(page).toHaveURL(/\/view$/)
})

test('benchmark metrics load and an experiment opens its detail', async ({ page }) => {
  await page.goto('/metrics')

  await expect(page.locator('h1')).toHaveText('Benchmark metrics')
  // Real metric columns (e.g. BLEU-1) and at least one experiment row.
  await expect(page.locator('thead th').filter({ hasText: 'BLEU-1' }).first()).toBeVisible()
  const rows = page.locator('tbody tr.row')
  await expect(rows.first()).toBeVisible()

  await rows.first().click()
  await expect(page).toHaveURL(/\/metrics\/\d+$/)
  await expect(page.locator('h1')).not.toBeEmpty()
})
