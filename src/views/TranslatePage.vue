<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getJob, jobEventsUrl, listModels, submitTranslation } from '@/api/client'
import type { Job, ModelInfo } from '@/api/types'

const models = ref<ModelInfo[]>([])
const selectedModel = ref('')
const videoFile = ref<File | null>(null)

const job = ref<Job | null>(null)
const submitting = ref(false)
const error = ref<string | null>(null)

let eventSource: EventSource | null = null

const isProcessing = computed(
  () => job.value?.status === 'pending' || job.value?.status === 'running',
)
const isSucceeded = computed(() => job.value?.status === 'succeeded')
const isFailed = computed(() => job.value?.status === 'failed')
const canSubmit = computed(
  () => !!selectedModel.value && !!videoFile.value && !submitting.value && !isProcessing.value,
)

function closeStream() {
  if (eventSource) {
    eventSource.close()
    eventSource = null
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  videoFile.value = input.files?.[0] ?? null
}

async function onSubmit() {
  if (!canSubmit.value || !videoFile.value) {
    return
  }

  closeStream()
  error.value = null
  job.value = null
  submitting.value = true

  try {
    const accepted = await submitTranslation(selectedModel.value, videoFile.value)
    streamJob(accepted.job_id)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to submit translation.'
  } finally {
    submitting.value = false
  }
}

function streamJob(jobId: string) {
  const es = new EventSource(jobEventsUrl(jobId))
  eventSource = es

  es.onmessage = (event) => {
    const snapshot = JSON.parse(event.data) as Job
    job.value = snapshot
    if (snapshot.status === 'succeeded' || snapshot.status === 'failed') {
      closeStream()
    }
  }

  es.onerror = async () => {
    closeStream()
    // The stream may have dropped right after the job finished; poll once as a fallback.
    try {
      const snapshot = await getJob(jobId)
      job.value = snapshot
      if (snapshot.status !== 'succeeded' && snapshot.status !== 'failed') {
        error.value = 'Lost connection to the translation stream.'
      }
    } catch {
      error.value = 'Lost connection to the translation stream.'
    }
  }
}

onMounted(async () => {
  try {
    models.value = await listModels()
    if (models.value.length > 0) {
      selectedModel.value = models.value[0]!.name
    }
  } catch (err) {
    error.value =
      err instanceof Error ? `Couldn't load models: ${err.message}` : "Couldn't load models."
  }
})

onUnmounted(closeStream)
</script>

<template>
  <main class="translate">
    <h1>PJM Sign Language Translation</h1>
    <p class="subtitle">Pick a model, upload a sign-language video, and get the translated text.</p>

    <form class="form" @submit.prevent="onSubmit">
      <label class="field">
        <span>Model</span>
        <select v-model="selectedModel" :disabled="models.length === 0">
          <option v-for="model in models" :key="model.name" :value="model.name">
            {{ model.name }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Video</span>
        <input type="file" accept="video/*" @change="onFileChange" />
      </label>

      <button type="submit" :disabled="!canSubmit">Translate</button>
    </form>

    <section v-if="isProcessing" class="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>Translating… ({{ job?.status }})</span>
    </section>

    <section v-else-if="isSucceeded" class="result">
      <h2>Translation</h2>
      <p class="result-text">{{ job?.result?.text }}</p>
    </section>

    <p v-else-if="isFailed" class="error">{{ job?.error ?? 'Translation failed.' }}</p>

    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>

<style scoped>
.translate {
  max-width: 40rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.subtitle {
  color: #666;
  margin-top: 0.25rem;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 1.5rem 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field span {
  font-weight: 600;
}

button {
  align-self: flex-start;
  padding: 0.5rem 1.25rem;
  font-size: 1rem;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 3px solid #ccc;
  border-top-color: #2c3e50;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.result-text {
  padding: 1rem;
  background: #f4f6f8;
  border-radius: 0.5rem;
  white-space: pre-wrap;
}

.error {
  color: #c0392b;
}
</style>
