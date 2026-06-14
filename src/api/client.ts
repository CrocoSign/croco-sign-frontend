import type {
  ApiError,
  Job,
  ModelInfo,
  SegmentDetail,
  SegmentPage,
  TranslateAccepted,
} from './types'

// Backend base URL. Defaults to the local dev server; override with VITE_API_BASE_URL.
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// Turns a non-2xx response into an Error carrying the backend's { code, message }.
async function toError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as Partial<ApiError>
    if (body && typeof body.message === 'string') {
      return new Error(body.message)
    }
  } catch {
    // fall through to a generic message
  }
  return new Error(`Request failed (${response.status})`)
}

// GET /models — list available translation models.
export async function listModels(): Promise<ModelInfo[]> {
  const response = await fetch(`${API_BASE}/models`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as ModelInfo[]
}

// POST /models/{model_name}/translate — submit a video; returns 202 with a job id.
export async function submitTranslation(
  modelName: string,
  video: File,
  targetLanguage = 'en',
): Promise<TranslateAccepted> {
  const form = new FormData()
  form.append('video', video)
  form.append('target_language', targetLanguage)

  const response = await fetch(`${API_BASE}/models/${encodeURIComponent(modelName)}/translate`, {
    method: 'POST',
    body: form,
  })
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as TranslateAccepted
}

// GET /jobs/{job_id} — one-shot status poll (used as an SSE fallback).
export async function getJob(jobId: string): Promise<Job> {
  const response = await fetch(`${API_BASE}/jobs/${encodeURIComponent(jobId)}`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as Job
}

// URL for the SSE stream of job status changes (GET /jobs/{job_id}/events).
export function jobEventsUrl(jobId: string): string {
  return `${API_BASE}/jobs/${encodeURIComponent(jobId)}/events`
}

// GET /segments — one page of segment records (offset-based pagination).
export async function listSegments(limit: number, offset: number): Promise<SegmentPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  const response = await fetch(`${API_BASE}/segments?${params}`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as SegmentPage
}

// GET /segments/{id} — full detail for one segment.
export async function getSegment(id: number): Promise<SegmentDetail> {
  const response = await fetch(`${API_BASE}/segments/${id}`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as SegmentDetail
}

// URL for a segment's mp4 clip (GET /segments/{id}/video) — used as a <video> src.
export function segmentVideoUrl(id: number): string {
  return `${API_BASE}/segments/${id}/video`
}
