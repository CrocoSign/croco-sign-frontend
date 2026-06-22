import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  API_BASE,
  experimentArchitectureUrl,
  fetchSegmentVideoFile,
  getExperiment,
  getJob,
  getMetrics,
  getSegment,
  getSegmentFilters,
  jobEventsUrl,
  listModels,
  listSegments,
  segmentVideoUrl,
  submitTranslation,
} from '@/api/client'

// A minimal Response-like stand-in for the global fetch mock.
function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// The arguments / URL passed to fetch on the most recent call.
function lastCall(): [string, RequestInit] {
  const calls = fetchMock.mock.calls
  return calls[calls.length - 1] as [string, RequestInit]
}
function lastUrl(): string {
  return String(lastCall()[0])
}

describe('API_BASE', () => {
  it('is an absolute URL ending in :8000', () => {
    expect(typeof API_BASE).toBe('string')
    expect(API_BASE).toMatch(/^https?:\/\/.+:8000$/)
  })
})

describe('URL builders', () => {
  it('builds the SSE, video and architecture URLs against API_BASE', () => {
    expect(jobEventsUrl('job 1')).toBe(`${API_BASE}/jobs/job%201/events`)
    expect(segmentVideoUrl(42)).toBe(`${API_BASE}/segments/42/video`)
    expect(experimentArchitectureUrl(7)).toBe(`${API_BASE}/experiments/7/architecture`)
  })
})

describe('toError (via failing requests)', () => {
  it('uses the backend message when present', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'bad', message: 'Nope' }, false, 422))
    await expect(listModels()).rejects.toThrow('Nope')
  })

  it('falls back to a generic message when the body has no message', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'bad' }, false, 500))
    await expect(listModels()).rejects.toThrow('Request failed (500)')
  })

  it('falls back to a generic message when the body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => {
        throw new Error('not json')
      },
    } as unknown as Response)
    await expect(listModels()).rejects.toThrow('Request failed (503)')
  })
})

describe('listModels / getJob / getMetrics / getExperiment / getSegment / getSegmentFilters', () => {
  it('return parsed JSON on success and hit the right path', async () => {
    fetchMock.mockResolvedValue(jsonResponse([{ name: 'a' }]))
    expect(await listModels()).toEqual([{ name: 'a' }])
    expect(lastUrl()).toBe(`${API_BASE}/models`)

    fetchMock.mockResolvedValue(jsonResponse({ job_id: 'x' }))
    await getJob('j 1')
    expect(lastUrl()).toBe(`${API_BASE}/jobs/j%201`)

    fetchMock.mockResolvedValue(jsonResponse({ metrics: [], experiments: [] }))
    await getMetrics()
    expect(lastUrl()).toBe(`${API_BASE}/metrics`)

    fetchMock.mockResolvedValue(jsonResponse({ id: 3 }))
    await getExperiment(3)
    expect(lastUrl()).toBe(`${API_BASE}/experiments/3`)

    fetchMock.mockResolvedValue(jsonResponse({ id: 5 }))
    await getSegment(5)
    expect(lastUrl()).toBe(`${API_BASE}/segments/5`)

    fetchMock.mockResolvedValue(jsonResponse({ ages: [], sexes: [], speaker_ids: [] }))
    await getSegmentFilters()
    expect(lastUrl()).toBe(`${API_BASE}/segments/filters`)
  })

  it('throws on a non-ok getter response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'boom' }, false, 404))
    await expect(getSegment(1)).rejects.toThrow('boom')
  })
})

describe('listSegments', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], total: 0 }))
  })

  it('sets limit and offset', async () => {
    await listSegments(25, 50)
    const url = new URL(lastUrl())
    expect(url.pathname).toBe('/segments')
    expect(url.searchParams.get('limit')).toBe('25')
    expect(url.searchParams.get('offset')).toBe('50')
  })

  it('appends array filters as repeated params and omits empty sentence', async () => {
    await listSegments(10, 0, { age: ['20', '30'], sex: ['F'], speaker_id: [], sentence: '' })
    const params = new URL(lastUrl()).searchParams
    expect(params.getAll('age')).toEqual(['20', '30'])
    expect(params.getAll('sex')).toEqual(['F'])
    expect(params.getAll('speaker_id')).toEqual([])
    expect(params.has('sentence')).toBe(false)
  })

  it('sets a non-empty sentence', async () => {
    await listSegments(10, 0, { sentence: 'hello' })
    expect(new URL(lastUrl()).searchParams.get('sentence')).toBe('hello')
  })
})

describe('submitTranslation', () => {
  it('encodes the model name and posts FormData with the default language', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ job_id: 'j', status: 'pending', status_url: 'u' }))
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })

    await submitTranslation('uni sign', file)

    const [url, init] = lastCall()
    expect(url).toBe(`${API_BASE}/models/uni%20sign/translate`)
    expect(init.method).toBe('POST')
    const body = init.body as FormData
    expect(body.get('video')).toBe(file)
    expect(body.get('target_language')).toBe('en')
  })

  it('uses the provided target language', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ job_id: 'j', status: 'pending', status_url: 'u' }))
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' })

    await submitTranslation('mock', file, 'pl')

    const init = lastCall()[1]
    expect((init.body as FormData).get('target_language')).toBe('pl')
  })
})

describe('fetchSegmentVideoFile', () => {
  it('wraps the response blob in a named File using its mime type', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['video-bytes'], { type: 'video/webm' }),
    } as unknown as Response)

    const file = await fetchSegmentVideoFile(9)

    expect(lastUrl()).toBe(`${API_BASE}/segments/9/video`)
    expect(file).toBeInstanceOf(File)
    expect(file.name).toBe('segment-9.mp4')
    expect(file.type).toBe('video/webm')
  })

  it('falls back to video/mp4 when the blob has no type', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['bytes']),
    } as unknown as Response)

    const file = await fetchSegmentVideoFile(1)
    expect(file.type).toBe('video/mp4')
  })

  it('throws on a non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'gone' }, false, 404))
    await expect(fetchSegmentVideoFile(1)).rejects.toThrow('gone')
  })
})
