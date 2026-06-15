<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  fetchSegmentVideoFile,
  getJob,
  getSegment,
  jobEventsUrl,
  listModels,
  submitTranslation,
} from '@/api/client'
import type { Job, ModelInfo } from '@/api/types'

const route = useRoute()
const { t } = useI18n()

const models = ref<ModelInfo[]>([])
// One or more models to translate with; comparing = simply add another row.
const selectedModels = ref<string[]>([])
const selectedLanguage = ref<'en' | 'pl'>('en')
const videoFile = ref<File | null>(null)

// Models can be added until every available one is in the list.
const canAddModel = computed(
  () => models.value.length > 0 && selectedModels.value.length < models.value.length,
)

function firstUnusedModel(): string | undefined {
  return models.value.find((m) => !selectedModels.value.includes(m.name))?.name
}

function addModel() {
  const next = firstUnusedModel() ?? models.value[0]?.name
  if (next) {
    selectedModels.value.push(next)
  }
}

function removeModel(index: number) {
  selectedModels.value.splice(index, 1)
}

// When the video was pre-loaded from a segment, we hold its reference sentence
// (ground truth) for side-by-side comparison and the segment id for a UI note.
const referenceText = ref<string | null>(null)
const prefillName = ref<string | null>(null)
const loadingSegment = ref(false)

// Live preview of the chosen (or segment-loaded) video, right in the form.
const videoPreviewUrl = ref<string | null>(null)
const fileName = computed(() => videoFile.value?.name ?? '')
watch(videoFile, (file) => {
  if (videoPreviewUrl.value) {
    URL.revokeObjectURL(videoPreviewUrl.value)
  }
  videoPreviewUrl.value = file ? URL.createObjectURL(file) : null
})

// One slot per translation in flight: a single model in basic mode, two in
// advanced (compare) mode. Each slot streams its own job independently.
interface ResultSlot {
  model: string
  job: Job | null
}
const slots = ref<ResultSlot[]>([])
let eventSources: EventSource[] = []

const submitting = ref(false)
const error = ref<string | null>(null)

const isProcessing = computed(() =>
  slots.value.some((s) => s.job?.status === 'pending' || s.job?.status === 'running'),
)
const canSubmit = computed(
  () =>
    selectedModels.value.length > 0 &&
    selectedModels.value.every((m) => !!m) &&
    !!videoFile.value &&
    !submitting.value &&
    !loadingSegment.value &&
    !isProcessing.value,
)

function closeStreams() {
  for (const es of eventSources) {
    es.close()
  }
  eventSources = []
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  // Ignore an empty change (e.g. the picker was cancelled) so it can't wipe out
  // a video/reference already prefilled from a segment.
  if (!file) {
    return
  }
  videoFile.value = file
  // The reference no longer applies once the user picks their own file.
  prefillName.value = null
  referenceText.value = null
}

async function loadFromSegment(id: number) {
  loadingSegment.value = true
  try {
    const detail = await getSegment(id)
    referenceText.value = detail.sentence
    videoFile.value = await fetchSegmentVideoFile(id)
    prefillName.value = detail.segment_id
  } catch (err) {
    error.value = err instanceof Error
      ? t('translate.errors.loadSegment', { message: err.message })
      : t('translate.errors.loadSegmentGeneric')
  } finally {
    loadingSegment.value = false
  }
}

async function onSubmit() {
  if (!canSubmit.value || !videoFile.value) {
    return
  }

  closeStreams()
  error.value = null
  slots.value = []
  submitting.value = true

  // De-duplicate so the same model isn't translated twice.
  const chosenModels = [...new Set(selectedModels.value)]

  try {
    const accepted = await Promise.all(
      chosenModels.map((model) =>
        submitTranslation(model, videoFile.value!, selectedLanguage.value),
      ),
    )
    slots.value = chosenModels.map((model) => ({ model, job: null }))
    accepted.forEach((a, index) => streamJob(index, a.job_id))
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('translate.errors.submit')
  } finally {
    submitting.value = false
  }
}

function streamJob(index: number, jobId: string) {
  const es = new EventSource(jobEventsUrl(jobId))
  eventSources.push(es)

  es.onmessage = (event) => {
    const snapshot = JSON.parse(event.data) as Job
    setJob(index, snapshot)
    if (snapshot.status === 'succeeded' || snapshot.status === 'failed') {
      es.close()
    }
  }

  es.onerror = async () => {
    es.close()
    // The stream may have dropped right after the job finished; poll once as a fallback.
    try {
      const snapshot = await getJob(jobId)
      setJob(index, snapshot)
      if (snapshot.status !== 'succeeded' && snapshot.status !== 'failed') {
        error.value = t('translate.errors.stream')
      }
    } catch {
      error.value = t('translate.errors.stream')
    }
  }
}

function setJob(index: number, job: Job) {
  const slot = slots.value[index]
  if (slot) {
    slot.job = job
  }
}

onMounted(async () => {
  try {
    models.value = await listModels()
    if (models.value.length > 0) {
      // Start with one model selected; the user adds more to compare.
      selectedModels.value = [models.value[0]!.name]
    }
  } catch (err) {
    error.value =
      err instanceof Error
        ? t('translate.errors.loadModels', { message: err.message })
        : t('translate.errors.loadModelsGeneric')
  }

  const segmentId = route?.query?.segmentId
  if (typeof segmentId === 'string') {
    await loadFromSegment(Number(segmentId))
  }
})

onUnmounted(() => {
  closeStreams()
  if (videoPreviewUrl.value) {
    URL.revokeObjectURL(videoPreviewUrl.value)
  }
})
</script>

<template>
  <main class="container translate">
    <header class="translate__head">
      <h1>{{ t('translate.title') }}</h1>
      <p class="subtitle">{{ t('translate.subtitle') }}</p>
    </header>

    <div class="translate__grid">
      <form class="form card translate__input" @submit.prevent="onSubmit">
      <div class="field">
        <span class="field__label">
          {{ t('translate.models') }}
          <span v-if="selectedModels.length > 1" class="count-badge">{{ selectedModels.length }}</span>
        </span>

        <div class="model-list">
          <div v-for="(_, index) in selectedModels" :key="index" class="model-row">
            <select v-model="selectedModels[index]" :disabled="models.length === 0">
              <option v-for="model in models" :key="model.name" :value="model.name">
                {{ model.name }}
              </option>
            </select>
            <button
              v-if="selectedModels.length > 1"
              type="button"
              class="model-remove"
              :aria-label="t('translate.removeModel')"
              :title="t('translate.removeModel')"
              @click="removeModel(index)"
            >
              ✕
            </button>
          </div>
        </div>

        <button
          type="button"
          class="btn btn-secondary btn-sm add-model"
          :disabled="!canAddModel"
          @click="addModel"
        >
          + {{ t('translate.addModel') }}
        </button>
      </div>

      <label class="field language-field">
        <span class="field__label">{{ t('translate.language') }}</span>
        <select v-model="selectedLanguage">
          <option value="en">{{ t('common.english') }}</option>
          <option value="pl">{{ t('common.polish') }}</option>
        </select>
      </label>

      <div class="field video-field">
        <span class="field__label">{{ t('translate.video') }}</span>
        <label class="filepick">
          <input
            class="filepick__input"
            type="file"
            accept="video/*"
            @change="onFileChange"
          />
          <span class="filepick__btn">{{ t('translate.chooseVideo') }}</span>
          <span class="filepick__name" :class="{ 'filepick__name--empty': !fileName }">
            {{ fileName || t('translate.noFile') }}
          </span>
        </label>

        <span v-if="loadingSegment" class="prefill">
          <span class="spinner" aria-hidden="true"></span>
          {{ t('translate.loadingSegment') }}
        </span>
        <span v-else-if="prefillName" class="prefill">
          {{ t('translate.usingSegment', { name: prefillName }) }}
        </span>

        <video
          v-if="videoPreviewUrl"
          class="preview"
          :src="videoPreviewUrl"
          controls
          playsinline
        ></video>
      </div>

        <button type="submit" class="btn btn-primary submit" :disabled="!canSubmit">
          {{ t('translate.submit') }}
        </button>
      </form>

      <!-- Output column - sits beside the input, like a translator. -->
      <div class="translate__output">
        <section v-if="referenceText" class="card reference">
          <h2 class="panel__model">{{ t('translate.reference') }}</h2>
          <p class="result-text">{{ referenceText }}</p>
        </section>

        <div v-if="slots.length > 0" class="results">
          <article v-for="(slot, index) in slots" :key="index" class="card panel">
            <h2 class="panel__model">{{ slot.model }}</h2>

            <div
              v-if="slot.job?.status === 'pending' || slot.job?.status === 'running'"
              class="status"
            >
              <span class="spinner" aria-hidden="true"></span>
              <span>{{ t('translate.translatingStatus', { status: slot.job?.status }) }}</span>
            </div>

            <p v-else-if="slot.job?.status === 'succeeded'" class="result-text">
              {{ slot.job?.result?.text }}
            </p>

            <p v-else-if="slot.job?.status === 'failed'" class="error">
              {{ slot.job?.error ?? t('translate.failed') }}
            </p>

            <div v-else class="status">
              <span class="spinner" aria-hidden="true"></span>
              <span>{{ t('translate.translating') }}</span>
            </div>
          </article>
        </div>

        <div v-else class="card output-empty">
          <p>{{ t('translate.outputEmpty') }}</p>
        </div>
      </div>
    </div>

    <p v-if="error" class="error error-banner">{{ error }}</p>
  </main>
</template>

<style scoped>
.translate {
  padding-block: 2rem;
  color: var(--text);
}

.translate__head {
  margin-bottom: 1.5rem;
}

.subtitle {
  color: var(--text-muted);
  margin-top: 0.35rem;
}

/* Sections share one card style → consistent width and rhythm. */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: 1.5rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  align-items: flex-start;
}

.field__label {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: var(--text);
}

.count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  height: 1.4rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  font-size: 0.8rem;
  font-weight: 700;
}

/* Dynamic model list - add / remove rows to compare 1..N models. */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  width: 100%;
  max-width: 28rem;
}

.model-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.model-row select {
  flex: 1;
  min-width: 0;
}

.model-remove {
  flex-shrink: 0;
  width: 2.1rem;
  height: 2.1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
}

.model-remove:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.add-model:disabled {
  opacity: 0.5;
}

.language-field select {
  min-width: 12rem;
}

.video-field {
  gap: 0.75rem;
}

/* Custom file picker - native input clipped, styled trigger + filename. */
.filepick {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  max-width: 100%;
}

.filepick__input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  border: 0;
}

.filepick__btn {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 1.1rem;
  border-radius: 999px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  font-weight: 600;
  white-space: nowrap;
}

.filepick:hover .filepick__btn {
  border-color: var(--text-muted);
}

.filepick__input:focus-visible + .filepick__btn {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.filepick__name {
  color: var(--text);
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filepick__name--empty {
  color: var(--text-muted);
}

.preview {
  width: 100%;
  max-width: 30rem;
  max-height: 60vh;
  margin-top: 0.25rem;
  background: #000;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.prefill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-muted);
}

.submit {
  align-self: flex-start;
}

/* Translator-style two columns: input on the left, output on the right. */
.translate__grid {
  display: grid;
  grid-template-columns: minmax(0, 23rem) 1fr;
  gap: 1.5rem;
  align-items: start;
}

.translate__output {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

@media (max-width: 52rem) {
  .translate__grid {
    grid-template-columns: 1fr;
  }
}

.results {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1.25rem;
}

.output-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 14rem;
  text-align: center;
  color: var(--text-muted);
}

.output-empty p {
  margin: 0;
  max-width: 22rem;
}

.panel__model {
  margin-top: 0;
  font-size: 1.05rem;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
}

.result-text {
  margin: 0;
  padding: 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  white-space: pre-wrap;
}

.error-banner {
  margin-top: 1.5rem;
  padding: 0.85rem 1rem;
  background: var(--danger-soft);
  border: 1px solid var(--danger);
  border-radius: var(--radius);
}

/* ---- Mobile ---- */
@media (max-width: 36rem) {
  .card {
    padding: 1.15rem;
  }

  .preview {
    max-width: 100%;
  }
}
</style>
