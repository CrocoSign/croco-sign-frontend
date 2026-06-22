import { test, expect } from '@playwright/test'
import { fakeVideo, usePreferences } from './support'

// These hit the REAL backend on :8000 and run a real translation job using the
// registered `mock` PJM model (no signing model/GPU needed); stage 2 (DeepL) and,
// for the segment flow, the HF clip stream are exercised for real.

test.beforeEach(async ({ page }) => {
  await usePreferences(page)
})

test('uploads a video to the mock model and shows the streamed result', async ({ page }) => {
  await page.goto('/translate')
  await expect(page.locator('h1')).toHaveText('PJM Sign Language Translation')

  // The mock model is registered by the backend.
  await page.locator('select').first().selectOption('mock')

  await page.locator('input[type="file"]').setInputFiles(fakeVideo)

  const submit = page.getByRole('button', { name: 'Translate', exact: true })
  await expect(submit).toBeEnabled()
  await submit.click()

  // Real job: enqueued (202) → worker runs → succeeded → result streamed via SSE.
  const panel = page.locator('.panel')
  await expect(panel.locator('.panel__model')).toHaveText('mock')
  await expect(panel.locator('.result-text')).toBeVisible()
  await expect(panel.locator('.result-text')).not.toBeEmpty()
})

test('translates a real corpus segment from its detail page', async ({ page }) => {
  // Open a real segment, then send its video to the translator.
  await page.goto('/view')
  await page.locator('tbody tr.row').first().click()
  await expect(page).toHaveURL(/\/view\/\d+$/)

  await page.getByRole('button', { name: 'Translate this segment' }).click()
  await expect(page).toHaveURL(/\/translate\?segmentId=\d+$/)

  // The segment's clip is fetched from the backend (streamed from HF) and prefilled,
  // with its sentence shown as the reference translation — no manual file pick.
  await expect(page.locator('.prefill')).toContainText('Using video from segment')
  await expect(page.locator('.reference .result-text')).not.toBeEmpty()

  await page.locator('select').first().selectOption('mock')

  const submit = page.getByRole('button', { name: 'Translate', exact: true })
  await expect(submit).toBeEnabled()
  await submit.click()

  await expect(page.locator('.panel .result-text')).toBeVisible()
  await expect(page.locator('.panel .result-text')).not.toBeEmpty()
})
