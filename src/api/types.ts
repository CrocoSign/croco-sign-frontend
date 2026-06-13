// DTOs mirroring the croco-sign-backend API.
// See croco-sign-backend/src/croco_sign/api/schemas.py for the source of truth.

export interface ModelInfo {
  name: string
}

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed'

export type Language = 'pl' | 'en' | 'de'

export interface TranslationResult {
  text: string
  target_language: Language
  model_name: string
  confidence: number | null
}

export interface Job {
  job_id: string
  model_name: string
  status: JobStatus
  target_language: Language
  created_at: string
  updated_at: string
  result: TranslationResult | null
  error: string | null
}

export interface TranslateAccepted {
  job_id: string
  status: JobStatus
  status_url: string
}

// Shape of the backend's error responses ({ code, message }).
export interface ApiError {
  code: string
  message: string
}
