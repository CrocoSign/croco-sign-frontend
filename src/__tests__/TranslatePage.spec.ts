import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import TranslatePage from '../views/TranslatePage.vue'
import type { Job } from '@/api/types'

// Mock the API client so tests don't hit the network.
vi.mock('@/api/client', () => ({
  listModels: vi.fn<typeof import('@/api/client').listModels>(),
  submitTranslation: vi.fn<typeof import('@/api/client').submitTranslation>(),
  getJob: vi.fn<typeof import('@/api/client').getJob>(),
  jobEventsUrl: (id: string) => `http://localhost:8000/jobs/${id}/events`,
}))

import { listModels, submitTranslation } from '@/api/client'

// Minimal EventSource stub that lets tests drive onmessage.
class MockEventSource {
  static last: MockEventSource | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(public url: string) {
    MockEventSource.last = this
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
    MockEventSource.last = null
  })

  it('populates the model dropdown on mount', async () => {
    vi.mocked(listModels).mockResolvedValue([{ name: 'mock' }])
    const wrapper = mount(TranslatePage)
    await flushPromises()

    const options = wrapper.findAll('select option')
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
})
