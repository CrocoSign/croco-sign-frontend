import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import {
  apiError,
  fakeBackend,
  installFetch,
  MockEventSource,
  mountApp,
} from './harness'
import type { Job } from '@/api/types'

const succeeded: Job = {
  job_id: 'job-1',
  model_name: 'mock',
  status: 'succeeded',
  target_language: 'en',
  created_at: '2026-06-21T10:00:00Z',
  updated_at: '2026-06-21T10:00:05Z',
  result: { text: 'Hello world', target_language: 'en', model_name: 'mock', confidence: 0.99 },
  error: null,
}

async function chooseFileAndSubmit(wrapper: Awaited<ReturnType<typeof mountApp>>['wrapper']) {
  const file = new File(['data'], 'clip.mp4', { type: 'video/mp4' })
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file] })
  await input.trigger('change')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  MockEventSource.reset()
  vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('translate flow (integration)', () => {
  it('lists models, submits a video and renders the streamed result', async () => {
    const spy = installFetch(fakeBackend({ models: [{ name: 'mock' }] }))
    const { wrapper } = await mountApp('/translate')

    // The real client fetched GET /models and populated the dropdown.
    expect(spy).toHaveBeenCalledWith('http://localhost:8000/models')
    expect(wrapper.findAll('select')[0]!.findAll('option')[0]!.text()).toBe('mock')

    await chooseFileAndSubmit(wrapper)

    // The video was POSTed to the model's translate endpoint as multipart form data.
    const postCall = spy.mock.calls.find((c) => String(c[0]).endsWith('/models/mock/translate'))!
    expect(postCall).toBeTruthy()
    expect((postCall[1] as RequestInit).method).toBe('POST')
    expect((postCall[1] as RequestInit).body).toBeInstanceOf(FormData)

    // The worker pushes a terminal status over the (mocked) SSE stream.
    expect(MockEventSource.last!.url).toBe('http://localhost:8000/jobs/job-1/events')
    MockEventSource.last!.emit(succeeded)
    await flushPromises()

    const panel = wrapper.get('.panel')
    expect(panel.text()).toContain('Hello world')
    expect(MockEventSource.last!.closed).toBe(true)
  })

  it('falls back to polling GET /jobs/{id} when the stream errors', async () => {
    const spy = installFetch(
      fakeBackend({ models: [{ name: 'mock' }], jobs: { 'job-1': succeeded } }),
    )
    const { wrapper } = await mountApp('/translate')
    await chooseFileAndSubmit(wrapper)

    // Stream drops; the page polls the job endpoint once and recovers the result.
    MockEventSource.last!.fail()
    await flushPromises()

    expect(spy).toHaveBeenCalledWith('http://localhost:8000/jobs/job-1')
    expect(wrapper.get('.panel').text()).toContain('Hello world')
  })

  it('surfaces the backend error message when loading models fails', async () => {
    installFetch(fakeBackend({ errors: { models: apiError('models down', 503) } }))
    const { wrapper } = await mountApp('/translate')

    // toError() unwrapped { code, message } and the page rendered it.
    expect(wrapper.text()).toContain('models down')
  })

  it('surfaces the backend error message when submission fails', async () => {
    installFetch(
      fakeBackend({
        models: [{ name: 'mock' }],
        errors: { translate: apiError('queue full', 429) },
      }),
    )
    const { wrapper } = await mountApp('/translate')
    await chooseFileAndSubmit(wrapper)

    expect(wrapper.text()).toContain('queue full')
  })
})
