import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import {
  apiError,
  fakeBackend,
  installFetch,
  MockIntersectionObserver,
  mountApp,
} from './harness'
import type { SegmentDetail, SegmentSummary } from '@/api/types'

const summary = (id: number): SegmentSummary => ({
  id,
  segment_id: `PJM_${id}`,
  sentence: `sentence ${id}`,
  age: '20-29',
  sex: 'F',
  speaker_id: 'sp1',
})

const detail = (id: number): SegmentDetail => ({
  id,
  segment_id: `PJM_${id}`,
  sentence: `sentence ${id}`,
  video_metadata: {
    id: 1,
    video_id: 10,
    video_url: 'https://example.com/v.mp4',
    subtitles_url: 'https://example.com/v.vtt',
    video_type: 'studio',
    task_id: 5,
    speaker_side: 'left',
    signer: { id: 1, speaker_id: 'sp1', sex: 'F', age: '20-29', special_case: 'none' },
  },
})

const facets = { ages: ['20-29'], sexes: ['F', 'M'], speaker_ids: ['sp1'] }

beforeEach(() => {
  MockIntersectionObserver.reset()
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('segments flow (integration)', () => {
  it('loads the first page, populates facets and shows the count', async () => {
    installFetch(
      fakeBackend({ segmentPage: { items: [summary(1), summary(2)], total: 2 }, facets }),
    )
    const { wrapper } = await mountApp('/view')

    expect(wrapper.findAll('tbody tr.row')).toHaveLength(2)
    // 2 sexes + 1 age + 1 speaker = 4 facet checkboxes.
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(4)
    expect(wrapper.find('.count').text()).toContain('2 of 2')
  })

  it('appends the next page when the scroll sentinel intersects', async () => {
    installFetch(
      fakeBackend({
        segmentPage: { items: [summary(1), summary(2), summary(3)], total: 3 },
        facets,
      }),
    )
    const { wrapper } = await mountApp('/view')
    // First page used the default page size; only some rows are loaded.
    const firstCount = wrapper.findAll('tbody tr.row').length
    expect(firstCount).toBeGreaterThan(0)

    MockIntersectionObserver.instances[0]!.trigger()
    await flushPromises()
    // Offset-based pagination (served for real by the fake backend) yielded all rows.
    expect(wrapper.findAll('tbody tr.row')).toHaveLength(3)
  })

  it('navigates to the detail page and loads the segment when a row is clicked', async () => {
    installFetch(
      fakeBackend({
        segmentPage: { items: [summary(42)], total: 1 },
        facets,
        segments: { 42: detail(42) },
      }),
    )
    const { wrapper, router } = await mountApp('/view')

    await wrapper.get('tbody tr.row').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('segment')
    expect(router.currentRoute.value.params.id).toBe('42')
    // SegmentDetailPage fetched GET /segments/42 and rendered it.
    expect(wrapper.find('h1').text()).toBe('PJM_42')
    expect(wrapper.text()).toContain('sentence 42')
  })

  it('still renders the list when the facets request fails (non-fatal)', async () => {
    installFetch(
      fakeBackend({
        segmentPage: { items: [summary(1)], total: 1 },
        errors: { filters: apiError('no facets', 500) },
      }),
    )
    const { wrapper } = await mountApp('/view')

    expect(wrapper.findAll('tbody tr.row')).toHaveLength(1)
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(0)
  })

  it('shows the unwrapped error message when the list request fails', async () => {
    installFetch(fakeBackend({ errors: { segments: apiError('db offline', 500) } }))
    const { wrapper } = await mountApp('/view')

    expect(wrapper.find('.error').text()).toContain('db offline')
  })
})
