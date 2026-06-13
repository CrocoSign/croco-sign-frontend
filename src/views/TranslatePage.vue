<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getJob, jobEventsUrl, listModels, submitTranslation } from '@/api/client'
import type { Job, ModelInfo } from '@/api/types'

const models = ref<ModelInfo[]>([])
const advancedMode = ref(false)
const selectedModel = ref('')
const selectedModelB = ref('')
const selectedLanguage = ref<'en' | 'pl'>('en')
const videoFile = ref<File | null>(null)

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
    !!selectedModel.value &&
    (!advancedMode.value || !!selectedModelB.value) &&
    !!videoFile.value &&
    !submitting.value &&
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
  videoFile.value = input.files?.[0] ?? null
}

async function onSubmit() {
  if (!canSubmit.value || !videoFile.value) {
    return
  }

  closeStreams()
  error.value = null
  slots.value = []
  submitting.value = true

  const chosenModels = advancedMode.value
    ? [selectedModel.value, selectedModelB.value]
    : [selectedModel.value]

  try {
    const accepted = await Promise.all(
      chosenModels.map((model) =>
        submitTranslation(model, videoFile.value!, selectedLanguage.value),
      ),
    )
    slots.value = chosenModels.map((model) => ({ model, job: null }))
    accepted.forEach((a, index) => streamJob(index, a.job_id))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to submit translation.'
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
        error.value = 'Lost connection to the translation stream.'
      }
    } catch {
      error.value = 'Lost connection to the translation stream.'
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
      selectedModel.value = models.value[0]!.name
      // Default the comparison model to a different one when available.
      selectedModelB.value = (models.value[1] ?? models.value[0]!).name
    }
  } catch (err) {
    error.value =
      err instanceof Error ? `Couldn't load models: ${err.message}` : "Couldn't load models."
  }
})

onUnmounted(closeStreams)
</script>

<template>
  <main class="translate" :class="{ 'translate--wide': advancedMode }">
    <h1>PJM Sign Language Translation</h1>
    <p class="subtitle">Pick a model, upload a sign-language video, and get the translated text.</p>

    <label class="toggle">
      <input type="checkbox" v-model="advancedMode" />
      <span>Compare two models</span>
    </label>

    <form class="form" @submit.prevent="onSubmit">
      <template v-if="advancedMode">
        <label class="field">
          <span>Model A</span>
          <select v-model="selectedModel" :disabled="models.length === 0">
            <option v-for="model in models" :key="model.name" :value="model.name">
              {{ model.name }}
            </option>
          </select>
        </label>

        <label class="field">
          <span>Model B</span>
          <select v-model="selectedModelB" :disabled="models.length === 0">
            <option v-for="model in models" :key="model.name" :value="model.name">
              {{ model.name }}
            </option>
          </select>
        </label>
      </template>

      <label v-else class="field">
        <span>Model</span>
        <select v-model="selectedModel" :disabled="models.length === 0">
          <option v-for="model in models" :key="model.name" :value="model.name">
            {{ model.name }}
          </option>
        </select>
      </label>

      <label class="field">
        <span>Language</span>
        <select v-model="selectedLanguage">
          <option value="en">English</option>
          <option value="pl">Polish</option>
        </select>
      </label>

      <label class="field">
        <span>Video</span>
        <input type="file" accept="video/*" @change="onFileChange" />
      </label>

      <button type="submit" :disabled="!canSubmit">Translate</button>
    </form>

    <section v-if="slots.length > 0" class="results">
      <article v-for="(slot, index) in slots" :key="index" class="panel">
        <h2>{{ slot.model }}</h2>

        <div v-if="slot.job?.status === 'pending' || slot.job?.status === 'running'" class="status">
          <span class="spinner" aria-hidden="true"></span>
          <span>Translating… ({{ slot.job?.status }})</span>
        </div>

        <p v-else-if="slot.job?.status === 'succeeded'" class="result-text">
          {{ slot.job?.result?.text }}
        </p>

        <p v-else-if="slot.job?.status === 'failed'" class="error">
          {{ slot.job?.error ?? 'Translation failed.' }}
        </p>

        <div v-else class="status">
          <span class="spinner" aria-hidden="true"></span>
          <span>Translating…</span>
        </div>
      </article>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
  </main>
</template>

<style scoped>
.translate {
  max-width: 40rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.translate--wide {
  max-width: 60rem;
}

.subtitle {
  color: #666;
  margin-top: 0.25rem;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  cursor: pointer;
  font-weight: 600;
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

.results {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.panel {
  flex: 1;
  min-width: 16rem;
}

.panel h2 {
  margin-top: 0;
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
