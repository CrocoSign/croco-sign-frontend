import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'

import SegmentDetailPage from '../views/SegmentDetailPage.vue'
import type { SegmentDetail } from '@/api/types'

vi.mock('@/api/client', () => ({
  getSegment: vi.fn<typeof import('@/api/client').getSegment>(),
  segmentVideoUrl: (id: number) => `http://localhost:8000/segments/${id}/video`,
}))

import { getSegment } from '@/api/client'

const detail: SegmentDetail = {
  id: 7,
  segment_id: 'PJM_007',
  sentence: 'The reference sentence.',
  video_metadata: {
    id: 1,
    video_id: 100,
    video_url: 'https://example.com/video.mp4',
    subtitles_url: 'https://example.com/subs.vtt',
    video_type: 'studio',
    task_id: 5,
    speaker_side: 'left',
    signer: { id: 1, speaker_id: 'sp1', sex: 'F', age: '20-29', special_case: 'none' },
  },
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/view', name: 'view', component: { template: '<div />' } },
      { path: '/view/:id', name: 'segment', component: SegmentDetailPage, props: true },
      { path: '/translate', name: 'translate', component: { template: '<div />' } },
    ],
  })
}

async function mountPage(id = '7') {
  const router = makeRouter()
  router.push('/view')
  await router.isReady()
  const wrapper = mount(SegmentDetailPage, { props: { id }, global: { plugins: [router] } })
  return { wrapper, router }
}

beforeEach(() => {
  vi.mocked(getSegment).mockReset()
})

describe('SegmentDetailPage', () => {
  it('shows a spinner while loading then renders the detail', async () => {
    let resolve!: (d: SegmentDetail) => void
    vi.mocked(getSegment).mockReturnValue(new Promise((r) => (resolve = r)))
    const { wrapper } = await mountPage()

    expect(wrapper.find('.spinner').exists()).toBe(true)

    resolve(detail)
    await flushPromises()

    expect(wrapper.find('h1').text()).toBe('PJM_007')
    expect(wrapper.find('.sentence').text()).toBe('The reference sentence.')
    // Metadata + external links.
    expect(wrapper.find('.meta').text()).toContain('left')
    const links = wrapper.findAll('.links a')
    expect(links[0]!.attributes('href')).toBe('https://example.com/video.mp4')
    expect(links[1]!.attributes('href')).toBe('https://example.com/subs.vtt')
    expect(links[0]!.attributes('target')).toBe('_blank')
  })

  it('points the video at the segment URL', async () => {
    vi.mocked(getSegment).mockResolvedValue(detail)
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.find('video').attributes('src')).toBe('http://localhost:8000/segments/7/video')
  })

  it('shows a fallback message when the video fails to load', async () => {
    vi.mocked(getSegment).mockResolvedValue(detail)
    const { wrapper } = await mountPage()
    await flushPromises()

    await wrapper.find('video').trigger('error')
    expect(wrapper.find('video').exists()).toBe(false)
    expect(wrapper.find('.error').text()).toContain("Couldn't load the video clip")
  })

  it('shows an error and retries', async () => {
    vi.mocked(getSegment).mockRejectedValueOnce(new Error('not found'))
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.find('.error').text()).toContain('not found')

    vi.mocked(getSegment).mockResolvedValueOnce(detail)
    await wrapper.find('.error button').trigger('click')
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('PJM_007')
  })

  it('refetches and clears state when the id prop changes', async () => {
    vi.mocked(getSegment).mockResolvedValue(detail)
    const { wrapper } = await mountPage('7')
    await flushPromises()
    expect(vi.mocked(getSegment)).toHaveBeenCalledWith(7)

    vi.mocked(getSegment).mockResolvedValue({ ...detail, id: 8, segment_id: 'PJM_008' })
    await wrapper.setProps({ id: '8' })
    await flushPromises()
    expect(vi.mocked(getSegment)).toHaveBeenCalledWith(8)
    expect(wrapper.find('h1').text()).toBe('PJM_008')
  })

  it('navigates to translate with the segment id', async () => {
    vi.mocked(getSegment).mockResolvedValue(detail)
    const { wrapper, router } = await mountPage()
    await flushPromises()
    const push = vi.spyOn(router, 'push')

    await wrapper.get('.translate-btn').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'translate', query: { segmentId: '7' } })
  })

  it('links back to the segment list', async () => {
    vi.mocked(getSegment).mockResolvedValue(detail)
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.find('a.back').attributes('href')).toBe('/view')
  })
})
