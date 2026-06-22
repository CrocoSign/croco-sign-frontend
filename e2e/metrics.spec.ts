import { test, expect } from '@playwright/test'
import { experimentDetail, metricsTable, mockBackend, usePreferences } from './support/backend'

test.beforeEach(async ({ page }) => {
  await usePreferences(page)
})

test('renders the benchmark matrix and opens an experiment detail', async ({ page }) => {
  await mockBackend(page, { metrics: metricsTable, experiments: { 7: experimentDetail } })
  await page.goto('/metrics')

  await expect(page.locator('h1')).toHaveText('Benchmark metrics')
  await expect(page.locator('thead th')).toContainText(['BLEU', 'ROUGE'])
  await expect(page.locator('tbody tr.row')).toHaveCount(1)
  await expect(page.locator('tbody tr.row').first()).toContainText('12.3')

  await page.locator('tbody tr.row').first().click()
  await expect(page).toHaveURL(/\/metrics\/7$/)
  await expect(page.locator('h1')).toContainText('Uni-Sign')
  await expect(page.getByText('12.3')).toBeVisible()
  await expect(page.getByText('45.6')).toBeVisible()
})

test('shows the error message when GET /metrics fails', async ({ page }) => {
  await page.route('http://localhost:8000/metrics', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'error', message: 'metrics unavailable' }),
    }),
  )
  await page.goto('/metrics')

  await expect(page.locator('.error')).toContainText('metrics unavailable')
})
