import type {
  ApiError,
  ExperimentDetail,
  Job,
  MetricsTable,
  ModelInfo,
  SegmentDetail,
  SegmentFacets,
  SegmentFilters,
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

// GET /segments — one page of segment records (offset-based pagination, optional filters).
export async function listSegments(
  limit: number,
  offset: number,
  filters: SegmentFilters = {},
): Promise<SegmentPage> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      // Multi-select: one repeated query param per chosen value.
      value.forEach((v) => params.append(key, v))
    } else if (value) {
      params.set(key, value)
    }
  }
  const response = await fetch(`${API_BASE}/segments?${params}`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as SegmentPage
}

// GET /segments/filters — distinct values to populate the list's filter dropdowns.
export async function getSegmentFilters(): Promise<SegmentFacets> {
  const response = await fetch(`${API_BASE}/segments/filters`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as SegmentFacets
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

// GET /segments/{id}/video as a File, suitable for submitting to /translate.
export async function fetchSegmentVideoFile(id: number): Promise<File> {
  const response = await fetch(segmentVideoUrl(id))
  if (!response.ok) {
    throw await toError(response)
  }
  const blob = await response.blob()
  return new File([blob], `segment-${id}.mp4`, { type: blob.type || 'video/mp4' })
}

// GET /metrics — the full benchmark matrix (metric columns + experiment rows).
export async function getMetrics(): Promise<MetricsTable> {
  const response = await fetch(`${API_BASE}/metrics`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as MetricsTable
}

// GET /experiments/{id} — full detail for one experiment.
export async function getExperiment(id: number): Promise<ExperimentDetail> {
  const response = await fetch(`${API_BASE}/experiments/${id}`)
  if (!response.ok) {
    throw await toError(response)
  }
  return (await response.json()) as ExperimentDetail
}

// URL for an experiment's model architecture diagram (GET /experiments/{id}/architecture).
export function experimentArchitectureUrl(id: number): string {
  return `${API_BASE}/experiments/${id}/architecture`
}
