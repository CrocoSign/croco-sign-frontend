// End-to-end test support.
//
// These specs drive the REAL built app in a REAL browser. To stay deterministic
// and avoid standing up the full backend stack (Redis + DeepL + signsdk), the
// backend HTTP API is intercepted with page.route(). The app derives its API base
// as `<protocol>//<hostname>:8000`, so on the Playwright dev/preview servers
// (both on localhost) every API call goes to http://localhost:8000.

import type { Page, Route } from '@playwright/test'

export interface ModelInfo {
  name: string
}
export interface SegmentSummary {
  id: number
  segment_id: string
  sentence: string
  age: string
  sex: string
  speaker_id: string
}
export interface BackendData {
  models?: ModelInfo[]
  segmentPage?: { items: SegmentSummary[]; total: number }
  facets?: { ages: string[]; sexes: string[]; speaker_ids: string[] }
  segments?: Record<number, unknown>
  metrics?: { metrics: unknown[]; experiments: unknown[] }
  experiments?: Record<number, unknown>
  translateAccepted?: { job_id: string; status: string; status_url: string }
  // Terminal job pushed over the SSE stream (and returned by the poll fallback).
  job?: Record<string, unknown>
}

// Pin language + theme before any app code runs, so copy and colours are
// deterministic regardless of the test machine's stored preferences.
export async function usePreferences(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('croco-lang', 'en')
    localStorage.setItem('croco-theme', 'light')
  })
}

const API = 'http://localhost:8000'

export async function mockBackend(page: Page, data: BackendData) {
  await page.route(`${API}/**`, async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const method = req.method()

    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    const error = (message: string, status = 500) =>
      json({ code: 'error', message }, status)

    if (method === 'GET' && path === '/models') {
      return json(data.models ?? [])
    }
    if (method === 'POST' && /^\/models\/[^/]+\/translate$/.test(path)) {
      return json(
        data.translateAccepted ?? {
          job_id: 'job-1',
          status: 'pending',
          status_url: `${API}/jobs/job-1`,
        },
      )
    }
    // SSE job stream: deliver the terminal status as a single event.
    if (method === 'GET' && /^\/jobs\/[^/]+\/events$/.test(path)) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify(data.job ?? {})}\n\n`,
      })
    }
    // Poll fallback used if the stream drops before the terminal status.
    if (method === 'GET' && /^\/jobs\/[^/]+$/.test(path)) {
      return json(data.job ?? {})
    }
    if (method === 'GET' && path === '/segments/filters') {
      return json(data.facets ?? { ages: [], sexes: [], speaker_ids: [] })
    }
    if (method === 'GET' && path === '/segments') {
      const page = data.segmentPage ?? { items: [], total: 0 }
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? page.items.length)
      return json({ items: page.items.slice(offset, offset + limit), total: page.total })
    }
    if (method === 'GET' && /^\/segments\/\d+$/.test(path)) {
      const id = Number(path.split('/')[2])
      const detail = data.segments?.[id]
      return detail ? json(detail) : error('not found', 404)
    }
    if (method === 'GET' && /^\/segments\/\d+\/video$/.test(path)) {
      return route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.from('mp4') })
    }
    if (method === 'GET' && path === '/metrics') {
      return json(data.metrics ?? { metrics: [], experiments: [] })
    }
    if (method === 'GET' && /^\/experiments\/\d+$/.test(path)) {
      const id = Number(path.split('/')[2])
      const detail = data.experiments?.[id]
      return detail ? json(detail) : error('not found', 404)
    }
    if (method === 'GET' && /^\/experiments\/\d+\/architecture$/.test(path)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('png') })
    }
    return error(`no mock for ${method} ${path}`, 404)
  })
}

// --- Fixtures ------------------------------------------------------------------
export const summary = (id: number): SegmentSummary => ({
  id,
  segment_id: `PJM_${id}`,
  sentence: `sentence ${id}`,
  age: '20-29',
  sex: 'F',
  speaker_id: 'sp1',
})

export const segmentDetail = (id: number) => ({
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

export const metricsTable = {
  metrics: [
    { id: 1, name: 'BLEU', description: 'BLEU score' },
    { id: 2, name: 'ROUGE', description: 'ROUGE score' },
  ],
  experiments: [
    {
      id: 7,
      model: { id: 1, display_name: 'Uni-Sign' },
      transfer_source: 'openasl',
      split: 'MS',
      scores: { BLEU: 12.3, ROUGE: 45.6 },
    },
  ],
}

export const experimentDetail = {
  id: 7,
  transfer_source: 'openasl',
  split: 'MS',
  model: { id: 1, display_name: 'Uni-Sign' },
  scores: [
    { metric: { id: 1, name: 'BLEU', description: 'BLEU score' }, value: 12.3 },
    { metric: { id: 2, name: 'ROUGE', description: 'ROUGE score' }, value: 45.6 },
  ],
}

export const succeededJob = {
  job_id: 'job-1',
  model_name: 'mock',
  status: 'succeeded',
  target_language: 'en',
  created_at: '2026-06-21T10:00:00Z',
  updated_at: '2026-06-21T10:00:05Z',
  result: { text: 'Hello world', target_language: 'en', model_name: 'mock', confidence: 0.99 },
  error: null,
}
