import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import TranslatePage from '../views/TranslatePage.vue'
import type { Job } from '@/api/types'

// Mock the API client so tests don't hit the network.
vi.mock('@/api/client', () => ({
  listModels: vi.fn<typeof import('@/api/client').listModels>(),
  submitTranslation: vi.fn<typeof import('@/api/client').submitTranslation>(),
  getJob: vi.fn<typeof import('@/api/client').getJob>(),
  getSegment: vi.fn<typeof import('@/api/client').getSegment>(),
  fetchSegmentVideoFile: vi.fn<typeof import('@/api/client').fetchSegmentVideoFile>(),
  jobEventsUrl: (id: string) => `http://localhost:8000/jobs/${id}/events`,
}))

import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { fetchSegmentVideoFile, getSegment, listModels, submitTranslation } from '@/api/client'

// Minimal EventSource stub that lets tests drive onmessage.
class MockEventSource {
  static last: MockEventSource | null = null
  static instances: MockEventSource[] = []
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(public url: string) {
    MockEventSource.last = this
    MockEventSource.instances.push(this)
  }
  emit(job: Job) {
    this.onmessage?.({ data: JSON.stringify(job) })
  }
  close() {
    this.closed = true
  }
}

vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)

const succeededJob: Job = {
  job_id: 'abc123',
  model_name: 'mock',
  status: 'succeeded',
  target_language: 'pl',
  created_at: '2026-06-13T10:30:00Z',
  updated_at: '2026-06-13T10:30:05Z',
  result: { text: 'Hello world', target_language: 'pl', model_name: 'mock', confidence: 0.99 },
  error: null,
}

describe('TranslatePage', () => {
  beforeEach(() => {
    vi.mocked(listModels).mockReset()
    vi.mocked(submitTranslation).mockReset()
    vi.mocked(getSegment).mockReset()
    vi.mocked(fetchSegmentVideoFile).mockReset()
    MockEventSource.last = null
    MockEventSource.instances = []
  })

  it('populates the model dropdown on mount', async () => {
    vi.mocked(listModels).mockResolvedValue([{ name: 'mock' }])
    const wrapper = mount(TranslatePage)
    await flushPromises()

    const options = wrapper.findAll('select')[0]!.findAll('option')
    expect(options).toHaveLength(1)
    expect(options[0]!.text()).toBe('mock')
  })

  it('disables submit until a file is chosen', async () => {
    vi.mocked(listModels).mockResolvedValue([{ name: 'mock' }])
    const wrapper = mount(TranslatePage)
    await flushPromises()

    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('renders the translation text when the job succeeds', async () => {
    vi.mocked(listModels).mockResolvedValue([{ name: 'mock' }])
    vi.mocked(submitTranslation).mockResolvedValue({
      job_id: 'abc123',
      status: 'pending',
      status_url: 'http://localhost:8000/jobs/abc123',
    })
    const wrapper = mount(TranslatePage)
    await flushPromises()

    // Simulate choosing a file.
    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    MockEventSource.last!.emit(succeededJob)
    await flushPromises()

    expect(wrapper.text()).toContain('Hello world')
    expect(MockEventSource.last!.closed).toBe(true)
  })

  it('submits the selected target language', async () => {
    vi.mocked(listModels).mockResolvedValue([{ name: 'mock' }])
    vi.mocked(submitTranslation).mockResolvedValue({
      job_id: 'abc123',
      status: 'pending',
      status_url: 'http://localhost:8000/jobs/abc123',
    })
    const wrapper = mount(TranslatePage)
    await flushPromises()

    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    const selects = wrapper.findAll('select')
    await selects[1]!.setValue('pl')

    await wrapper.get('form').trigger('submit')

    expect(vi.mocked(submitTranslation)).toHaveBeenCalledWith('mock', file, 'pl')
  })

  it('sends the video to two models and renders both results in advanced mode', async () => {
    vi.mocked(listModels).mockResolvedValue([{ name: 'alpha' }, { name: 'beta' }])
    vi.mocked(submitTranslation)
      .mockResolvedValueOnce({
        job_id: 'job-a',
        status: 'pending',
        status_url: 'http://localhost:8000/jobs/job-a',
      })
      .mockResolvedValueOnce({
        job_id: 'job-b',
        status: 'pending',
        status_url: 'http://localhost:8000/jobs/job-b',
      })
    const wrapper = mount(TranslatePage)
    await flushPromises()

    // Add a second model row to compare (advanced mode = another row).
    await wrapper.get('.add-model').trigger('click')

    // First row = alpha (default), second row = beta (first unused model).
    const selects = wrapper.findAll('select')
    await selects[0]!.setValue('alpha')
    await selects[1]!.setValue('beta')

    const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(vi.mocked(submitTranslation)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(submitTranslation)).toHaveBeenNthCalledWith(1, 'alpha', file, 'en')
    expect(vi.mocked(submitTranslation)).toHaveBeenNthCalledWith(2, 'beta', file, 'en')

    expect(MockEventSource.instances).toHaveLength(2)
    MockEventSource.instances[0]!.emit({
      ...succeededJob,
      model_name: 'alpha',
      result: { text: 'Result A', target_language: 'en', model_name: 'alpha', confidence: 0.9 },
    })
    MockEventSource.instances[1]!.emit({
      ...succeededJob,
      model_name: 'beta',
      result: { text: 'Result B', target_language: 'en', model_name: 'beta', confidence: 0.9 },
    })
    await flushPromises()

    const panels = wrapper.findAll('.panel')
    expect(panels).toHaveLength(2)
    expect(panels[0]!.text()).toContain('alpha')
    expect(panels[0]!.text()).toContain('Result A')
    expect(panels[1]!.text()).toContain('beta')
    expect(panels[1]!.text()).toContain('Result B')
  })

  it('prefills the video and reference text from a segmentId query param', async () => {
    vi.mocked(listModels).mockResolvedValue([{ name: 'mock' }])
    vi.mocked(getSegment).mockResolvedValue({
      id: 7,
      segment_id: 'PJM_007',
      sentence: 'The reference sentence.',
      video_metadata: {} as never,
    })
    const segmentFile = new File(['clip'], 'segment-7.mp4', { type: 'video/mp4' })
    vi.mocked(fetchSegmentVideoFile).mockResolvedValue(segmentFile)
    vi.mocked(submitTranslation).mockResolvedValue({
      job_id: 'abc123',
      status: 'pending',
      status_url: 'http://localhost:8000/jobs/abc123',
    })

    const router: Router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/translate', name: 'translate', component: TranslatePage }],
    })
    router.push({ name: 'translate', query: { segmentId: '7' } })
    await router.isReady()

    const wrapper = mount(TranslatePage, { global: { plugins: [router] } })
    await flushPromises()

    expect(vi.mocked(getSegment)).toHaveBeenCalledWith(7)
    expect(vi.mocked(fetchSegmentVideoFile)).toHaveBeenCalledWith(7)
    // Reference text and prefill note are shown.
    expect(wrapper.text()).toContain('The reference sentence.')
    expect(wrapper.text()).toContain('PJM_007')
    // Submit is enabled without manually choosing a file, and uses the segment's file.
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('form').trigger('submit')
    expect(vi.mocked(submitTranslation)).toHaveBeenCalledWith('mock', segmentFile, 'en')
  })

  it('drops the segment reference when the user attaches their own file', async () => {
    vi.mocked(listModels).mockResolvedValue([{ name: 'mock' }])
    vi.mocked(getSegment).mockResolvedValue({
      id: 7,
      segment_id: 'PJM_007',
      sentence: 'The reference sentence.',
      video_metadata: {} as never,
    })
    vi.mocked(fetchSegmentVideoFile).mockResolvedValue(
      new File(['clip'], 'segment-7.mp4', { type: 'video/mp4' }),
    )
    vi.mocked(submitTranslation).mockResolvedValue({
      job_id: 'abc123',
      status: 'pending',
      status_url: 'http://localhost:8000/jobs/abc123',
    })

    const router: Router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/translate', name: 'translate', component: TranslatePage }],
    })
    router.push({ name: 'translate', query: { segmentId: '7' } })
    await router.isReady()

    const wrapper = mount(TranslatePage, { global: { plugins: [router] } })
    await flushPromises()
    expect(wrapper.text()).toContain('The reference sentence.')

    // The user picks their own file instead.
    const ownFile = new File(['mine'], 'mine.mp4', { type: 'video/mp4' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [ownFile] })
    await input.trigger('change')

    // Reference text and the prefill note are gone; the new file is used.
    expect(wrapper.text()).not.toContain('The reference sentence.')
    expect(wrapper.text()).not.toContain('PJM_007')

    await wrapper.get('form').trigger('submit')
    expect(vi.mocked(submitTranslation)).toHaveBeenCalledWith('mock', ownFile, 'en')
  })
})
