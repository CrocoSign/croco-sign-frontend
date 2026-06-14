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
  speaker_id: string
}

// A page of segments plus the total count matching the active filters.
export interface SegmentPage {
  items: SegmentSummary[]
  total: number
}

// Optional narrowing criteria for the segments list (GET /segments query params).
// age/sex/speaker_id are multi-select: each value is sent as a repeated param.
export interface SegmentFilters {
  age?: string[]
  sex?: string[]
  speaker_id?: string[]
  sentence?: string
}

// Distinct values available for each dropdown filter (GET /segments/filters).
export interface SegmentFacets {
  ages: string[]
  sexes: string[]
  speaker_ids: string[]
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

// An evaluated translation architecture (the architecture diagram is served as
// bytes by GET /experiments/{id}/architecture, so it's not a field here).
export interface BenchmarkModel {
  id: number
  display_name: string
}

// An evaluation metric column (GET /metrics).
export interface MetricDefinition {
  id: number
  name: string
  description: string
}

// One row of the benchmark matrix: scores keyed by metric name.
export interface ExperimentRow {
  id: number
  model: BenchmarkModel
  transfer_source: string
  split: string
  scores: Record<string, number>
}

// The full benchmark matrix (GET /metrics): ordered metric columns + rows.
export interface MetricsTable {
  metrics: MetricDefinition[]
  experiments: ExperimentRow[]
}

// One metric's value for an experiment, with its definition (GET /experiments/{id}).
export interface ExperimentScore {
  metric: MetricDefinition
  value: number
}

// Full detail for one experiment (GET /experiments/{id}).
export interface ExperimentDetail {
  id: number
  transfer_source: string
  split: string
  model: BenchmarkModel
  scores: ExperimentScore[]
}
