import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'

import ViewPage from '../views/ViewPage.vue'
import type { SegmentPage } from '@/api/types'

vi.mock('@/api/client', () => ({
  listSegments: vi.fn<typeof import('@/api/client').listSegments>(),
  getSegmentFilters: vi.fn<typeof import('@/api/client').getSegmentFilters>(),
}))

import { getSegmentFilters, listSegments } from '@/api/client'

// Controllable IntersectionObserver: capture the callback so tests drive scroll.
class MockObserver {
  static instances: MockObserver[] = []
  cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
    MockObserver.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  // Simulate the sentinel scrolling into view.
  trigger() {
    this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
  }
}

const row = (id: number) => ({
  id,
  segment_id: `PJM_${id}`,
  sentence: `sentence ${id}`,
  age: '20-29',
  sex: 'F',
  speaker_id: 'sp1',
})

const facets = { ages: ['20-29', '30-39'], sexes: ['F', 'M'], speaker_ids: ['sp1', 'sp2'] }

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/view', name: 'view', component: { template: '<div />' } },
      { path: '/view/:id', name: 'segment', component: { template: '<div />' } },
    ],
  })
}

async function mountPage() {
  const router = makeRouter()
  router.push('/view')
  await router.isReady()
  const wrapper = mount(ViewPage, { global: { plugins: [router] } })
  return { wrapper, router }
}

beforeEach(() => {
  vi.mocked(listSegments).mockReset()
  vi.mocked(getSegmentFilters).mockReset()
  vi.mocked(getSegmentFilters).mockResolvedValue(facets)
  MockObserver.instances = []
  vi.stubGlobal('IntersectionObserver', MockObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ViewPage', () => {
  it('loads the first page, populates filters and shows the count', async () => {
    vi.mocked(listSegments).mockResolvedValue({ items: [row(1), row(2)], total: 2 })
    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.findAll('tbody tr.row')).toHaveLength(2)
    // Three facet groups populated: 2 sexes + 2 ages + 2 speakers = 6 checkboxes.
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(6)
    expect(wrapper.find('.count').text()).toContain('2 of 2')
  })

  it('shows skeleton rows during the initial load', async () => {
    let resolve!: (page: SegmentPage) => void
    vi.mocked(listSegments).mockReturnValue(new Promise<SegmentPage>((r) => (resolve = r)))
    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.find('.skeleton-row').exists()).toBe(true)

    resolve({ items: [row(1)], total: 1 })
    await flushPromises()
    expect(wrapper.find('.skeleton-row').exists()).toBe(false)
  })

  it('appends pages on scroll and shows the end note when exhausted', async () => {
    vi.mocked(listSegments)
      .mockResolvedValueOnce({ items: [row(1)], total: 3 })
      .mockResolvedValueOnce({ items: [row(2)], total: 3 })
      .mockResolvedValueOnce({ items: [row(3)], total: 3 })
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.findAll('tbody tr.row')).toHaveLength(1)

    MockObserver.instances[0]!.trigger()
    await flushPromises()
    expect(wrapper.findAll('tbody tr.row')).toHaveLength(2)
    // Offset is the number already loaded.
    expect(vi.mocked(listSegments).mock.calls[1]![1]).toBe(1)

    MockObserver.instances[0]!.trigger()
    await flushPromises()
    expect(wrapper.findAll('tbody tr.row')).toHaveLength(3)
    expect(wrapper.find('.footer--muted').exists()).toBe(true)
  })

  it('does not fetch again once every row is loaded', async () => {
    vi.mocked(listSegments).mockResolvedValue({ items: [row(1)], total: 1 })
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(vi.mocked(listSegments)).toHaveBeenCalledTimes(1)

    MockObserver.instances[0]!.trigger()
    await flushPromises()
    expect(vi.mocked(listSegments)).toHaveBeenCalledTimes(1)
    expect(wrapper.exists()).toBe(true)
  })

  it('resets and refetches with the chosen filter when a checkbox is ticked', async () => {
    vi.mocked(listSegments).mockResolvedValue({ items: [row(1)], total: 1 })
    const { wrapper } = await mountPage()
    await flushPromises()

    await wrapper.get('input[type="checkbox"][value="F"]').setValue(true)
    await flushPromises()

    const calls = vi.mocked(listSegments).mock.calls
    const lastCall = calls[calls.length - 1]!
    expect(lastCall[1]).toBe(0) // offset reset
    expect(lastCall[2]!.sex).toEqual(['F'])
  })

  it('resets when the page size changes', async () => {
    vi.mocked(listSegments).mockResolvedValue({ items: [row(1)], total: 1 })
    const { wrapper } = await mountPage()
    await flushPromises()

    await wrapper.get('.page-size select').setValue(25)
    await flushPromises()

    const calls = vi.mocked(listSegments).mock.calls
    expect(calls[calls.length - 1]![0]).toBe(25)
  })

  it('debounces the search input', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(listSegments).mockResolvedValue({ items: [row(1)], total: 1 })
      const { wrapper } = await mountPage()
      await flushPromises()
      expect(vi.mocked(listSegments)).toHaveBeenCalledTimes(1)

      await wrapper.get('input[type="search"]').setValue('hello')

      vi.advanceTimersByTime(200)
      await flushPromises()
      expect(vi.mocked(listSegments)).toHaveBeenCalledTimes(1) // still debouncing

      vi.advanceTimersByTime(100)
      await flushPromises()
      expect(vi.mocked(listSegments)).toHaveBeenCalledTimes(2)
      const calls = vi.mocked(listSegments).mock.calls
      expect(calls[calls.length - 1]![2]!.sentence).toBe('hello')
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the empty state when there are no results', async () => {
    vi.mocked(listSegments).mockResolvedValue({ items: [], total: 0 })
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.find('.empty').exists()).toBe(true)
  })

  it('shows an error and retries', async () => {
    vi.mocked(listSegments).mockRejectedValueOnce(new Error('down'))
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.find('.error').text()).toContain('down')

    vi.mocked(listSegments).mockResolvedValueOnce({ items: [row(1)], total: 1 })
    await wrapper.get('.error button').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('tbody tr.row')).toHaveLength(1)
  })

  it('still loads the list when facets fail (non-fatal)', async () => {
    vi.mocked(getSegmentFilters).mockReset()
    vi.mocked(getSegmentFilters).mockRejectedValue(new Error('no facets'))
    vi.mocked(listSegments).mockResolvedValue({ items: [row(1)], total: 1 })
    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.findAll('tbody tr.row')).toHaveLength(1)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('navigates to a segment when a row is clicked', async () => {
    vi.mocked(listSegments).mockResolvedValue({ items: [row(42)], total: 1 })
    const { wrapper, router } = await mountPage()
    await flushPromises()
    const push = vi.spyOn(router, 'push')

    await wrapper.get('tbody tr.row').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'segment', params: { id: 42 } })
  })
})
