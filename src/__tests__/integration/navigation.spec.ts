import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { fakeBackend, installFetch, MockIntersectionObserver, mountApp } from './harness'

// jsdom lacks IntersectionObserver, which ViewPage sets up on mount.
beforeEach(() => {
  MockIntersectionObserver.reset()
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('top-level navigation (integration)', () => {
  it('redirects "/" to /translate', async () => {
    installFetch(fakeBackend({ models: [{ name: 'mock' }] }))
    const { router } = await mountApp('/')
    expect(router.currentRoute.value.name).toBe('translate')
  })

  it('navigates between sections via the nav bar, loading each page from the API', async () => {
    const spy = installFetch(
      fakeBackend({
        models: [{ name: 'mock' }],
        segmentPage: { items: [], total: 0 },
        facets: { ages: [], sexes: [], speaker_ids: [] },
        metrics: { metrics: [], experiments: [] },
      }),
    )
    const { wrapper, router } = await mountApp('/translate')

    const linkTo = (path: string) => wrapper.get(`.nav__links a[href="${path}"]`)

    await linkTo('/view').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('view')
    expect(spy).toHaveBeenCalledWith('http://localhost:8000/segments/filters')

    await linkTo('/metrics').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('metrics')
    expect(spy).toHaveBeenCalledWith('http://localhost:8000/metrics')

    await linkTo('/translate').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('translate')
  })
})
