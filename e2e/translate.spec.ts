import { test, expect } from '@playwright/test'
import { mockBackend, segmentDetail, succeededJob, usePreferences } from './support/backend'

test.beforeEach(async ({ page }) => {
  await usePreferences(page)
})

test('translates an uploaded video and shows the streamed result', async ({ page }) => {
  await mockBackend(page, { models: [{ name: 'mock' }], job: succeededJob })
  await page.goto('/translate')

  // Models loaded into the dropdown.
  await expect(page.locator('h1')).toHaveText('PJM Sign Language Translation')
  await expect(page.locator('select').first().locator('option')).toHaveText(['mock'])

  // Submit is disabled until a video is attached.
  const submit = page.getByRole('button', { name: 'Translate', exact: true })
  await expect(submit).toBeDisabled()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from('fake video bytes'),
  })
  await expect(submit).toBeEnabled()

  await submit.click()

  // The worker's terminal status arrives over the (mocked) SSE stream.
  const panel = page.locator('.panel')
  await expect(panel.locator('.panel__model')).toHaveText('mock')
  await expect(panel.locator('.result-text')).toHaveText('Hello world')
})

test('translates a segment via the segment detail page', async ({ page }) => {
  await mockBackend(page, {
    models: [{ name: 'mock' }],
    segments: { 1: segmentDetail(1) },
    job: succeededJob,
  })

  // Start on the segment's detail page.
  await page.goto('/view/1')
  await expect(page.locator('h1')).toHaveText('PJM_1')

  // Click through to the translator, carrying the segment.
  await page.getByRole('button', { name: 'Translate this segment' }).click()
  await expect(page).toHaveURL(/\/translate\?segmentId=1$/)

  // The segment's video is prefilled (fetched from /segments/1/video) and its
  // sentence shown as the reference translation — no manual file pick needed.
  await expect(page.locator('.prefill')).toHaveText('Using video from segment PJM_1')
  await expect(page.locator('.reference .result-text')).toHaveText('sentence 1')

  const submit = page.getByRole('button', { name: 'Translate', exact: true })
  await expect(submit).toBeEnabled()
  await submit.click()

  // The streamed result renders for the segment's video.
  const panel = page.locator('.panel')
  await expect(panel.locator('.panel__model')).toHaveText('mock')
  await expect(panel.locator('.result-text')).toHaveText('Hello world')
})

test('shows the backend error message when loading models fails', async ({ page }) => {
  await page.route('http://localhost:8000/models', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'error', message: 'models down' }),
    }),
  )
  await page.goto('/translate')

  await expect(page.locator('.error-banner')).toContainText('models down')
})
