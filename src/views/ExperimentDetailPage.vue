<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { experimentArchitectureUrl, getExperiment } from '@/api/client'
import type { ExperimentDetail } from '@/api/types'

const props = defineProps<{ id: string }>()

const experiment = ref<ExperimentDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const imageFailed = ref(false)

async function load() {
  loading.value = true
  error.value = null
  imageFailed.value = false
  experiment.value = null
  try {
    experiment.value = await getExperiment(Number(props.id))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load experiment.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
// Refetch when navigating directly between detail pages (same component reused).
watch(() => props.id, load)
</script>

<template>
  <main class="detail">
    <RouterLink class="back" :to="{ name: 'metrics' }">← Back to metrics</RouterLink>

    <div v-if="loading" class="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading…</span>
    </div>

    <p v-else-if="error" class="error">
      {{ error }}
      <button type="button" @click="load">Retry</button>
    </p>

    <template v-else-if="experiment">
      <h1>{{ experiment.model.display_name }}</h1>
      <p class="setup">
        <span>{{ experiment.transfer_source }}</span>
        <span class="sep">·</span>
        <span>{{ experiment.split }}</span>
      </p>

      <figure class="arch">
        <p v-if="imageFailed" class="error">Couldn't load the architecture diagram.</p>
        <img
          v-else
          :src="experimentArchitectureUrl(experiment.id)"
          :alt="`Architecture diagram for ${experiment.model.display_name}`"
          @error="imageFailed = true"
        />
        <figcaption>Model architecture</figcaption>
      </figure>

      <h2>Metrics</h2>
      <dl class="scores">
        <div v-for="score in experiment.scores" :key="score.metric.id" class="score">
          <dt>
            <span class="name">{{ score.metric.name }}</span>
            <span class="value">{{ score.value }}</span>
          </dt>
          <dd>{{ score.metric.description }}</dd>
        </div>
      </dl>
    </template>
  </main>
</template>

<style scoped>
.detail {
  max-width: 52rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.back {
  display: inline-block;
  margin-bottom: 1rem;
  color: #666;
  text-decoration: none;
  font-weight: 600;
}

.back:hover {
  color: #2c3e50;
}

h1 {
  color: #2c3e50;
  margin-bottom: 0.25rem;
}

.setup {
  color: #666;
  font-weight: 600;
  margin-top: 0;
}

.setup .sep {
  margin: 0 0.5rem;
  color: #ccc;
}

.arch {
  margin: 1.5rem 0;
}

.arch img {
  width: 100%;
  background: #fff;
  border: 1px solid #e3e6ea;
  border-radius: 0.5rem;
}

.arch figcaption {
  margin-top: 0.5rem;
  color: #666;
  font-size: 0.9rem;
  text-align: center;
}

h2 {
  color: #2c3e50;
}

.scores {
  margin: 0;
}

.score {
  padding: 0.75rem 0;
  border-bottom: 1px solid #f0f2f5;
}

.score:last-child {
  border-bottom: none;
}

.score dt {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-weight: 600;
  color: #2c3e50;
}

.score .value {
  font-variant-numeric: tabular-nums;
}

.score dd {
  margin: 0.25rem 0 0;
  color: #666;
  font-size: 0.95rem;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #666;
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

.error {
  color: #c0392b;
}

.error button {
  margin-left: 0.5rem;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
}
</style>
