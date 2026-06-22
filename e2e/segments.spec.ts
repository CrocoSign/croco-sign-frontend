import { test, expect } from '@playwright/test'
import { mockBackend, segmentDetail, summary, usePreferences } from './support/backend'

test.beforeEach(async ({ page }) => {
  await usePreferences(page)
})

test('lists segments, filters them and opens a detail page', async ({ page }) => {
  await mockBackend(page, {
    segmentPage: { items: [summary(1), summary(2)], total: 2 },
    facets: { ages: ['20-29'], sexes: ['F', 'M'], speaker_ids: ['sp1'] },
    segments: { 1: segmentDetail(1), 2: segmentDetail(2) },
  })
  await page.goto('/view')

  await expect(page.locator('tbody tr.row')).toHaveCount(2)
  await expect(page.locator('.count')).toContainText('2 of 2')
  // Facets rendered as checkboxes (2 sexes + 1 age + 1 speaker).
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(4)

  // Open the first segment and confirm its detail loads.
  await page.locator('tbody tr.row').first().click()
  await expect(page).toHaveURL(/\/view\/1$/)
  await expect(page.locator('h1')).toHaveText('PJM_1')
  await expect(page.getByText('sentence 1')).toBeVisible()

  // Back link returns to the list.
  await page.getByRole('link', { name: /Back to segments/ }).click()
  await expect(page).toHaveURL(/\/view$/)
})

test('shows the error message when the list request fails', async ({ page }) => {
  await page.route('http://localhost:8000/segments?**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'error', message: 'db offline' }),
    }),
  )
  await page.route('http://localhost:8000/segments/filters', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ages: [], sexes: [], speaker_ids: [] }),
    }),
  )
  await page.goto('/view')

  await expect(page.locator('.error')).toContainText('db offline')
})
