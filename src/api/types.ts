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

// One row of the segments list (GET /segments).
export interface SegmentSummary {
  id: number
  segment_id: string
  sentence: string
  age: string
  sex: string
}

// A page of segments plus the total count across the whole dataset.
export interface SegmentPage {
  items: SegmentSummary[]
  total: number
}

// The person who produced a recording (GET /segments/{id}).
export interface Signer {
  id: number
  speaker_id: string
  sex: string
  age: string
  special_case: string
}

// Metadata about the source recording a segment was cut from.
export interface VideoMetadata {
  id: number
  video_id: number
  video_url: string
  subtitles_url: string
  video_type: string
  task_id: number
  speaker_side: string
  signer: Signer
}

// Full detail for one segment (GET /segments/{id}).
export interface SegmentDetail {
  id: number
  segment_id: string
  sentence: string
  video_metadata: VideoMetadata
}
