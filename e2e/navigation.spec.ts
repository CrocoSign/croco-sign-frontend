import { test, expect } from '@playwright/test'
import { metricsTable, mockBackend, usePreferences } from './support/backend'

test.beforeEach(async ({ page }) => {
  await usePreferences(page)
})

test('root redirects to the translate page', async ({ page }) => {
  await mockBackend(page, { models: [{ name: 'mock' }] })
  await page.goto('/')

  await expect(page).toHaveURL(/\/translate$/)
  await expect(page.locator('h1')).toHaveText('PJM Sign Language Translation')
  await expect(page.locator('select').first()).toBeVisible()
})

test('navigates between sections via the nav bar', async ({ page }) => {
  await mockBackend(page, {
    models: [{ name: 'mock' }],
    segmentPage: { items: [], total: 0 },
    facets: { ages: [], sexes: [], speaker_ids: [] },
    metrics: metricsTable,
  })
  await page.goto('/translate')

  const nav = page.locator('.nav__links')

  await nav.getByRole('link', { name: 'Segments' }).click()
  await expect(page).toHaveURL(/\/view$/)
  await expect(page.locator('h1')).toHaveText('Segments')

  await nav.getByRole('link', { name: 'Metrics' }).click()
  await expect(page).toHaveURL(/\/metrics$/)
  await expect(page.locator('h1')).toHaveText('Benchmark metrics')

  await nav.getByRole('link', { name: 'Translate' }).click()
  await expect(page).toHaveURL(/\/translate$/)
  await expect(page.locator('h1')).toHaveText('PJM Sign Language Translation')
})

test('switches language to Polish', async ({ page }) => {
  await mockBackend(page, { models: [{ name: 'mock' }] })
  await page.goto('/translate')
  await expect(page.locator('h1')).toHaveText('PJM Sign Language Translation')

  await page.getByRole('button', { name: 'PL', exact: true }).click()
  await expect(page.locator('h1')).toHaveText('Tłumaczenie polskiego języka migowego (PJM)')
})
