<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { experimentArchitectureUrl, getExperiment } from '@/api/client'
import type { ExperimentDetail } from '@/api/types'
import type { AppLocale } from '@/i18n'
import { localizeModelName, localizeTransferSource } from '@/i18n/dataLabels'
import { codeUrl, weightsUrl } from '@/config/links'

const { t, locale } = useI18n()

const transfer = (v: string) => localizeTransferSource(v, locale.value as AppLocale)
const modelName = (v: string) => localizeModelName(v, locale.value as AppLocale)

// External links for this case: architecture code repo + trained weights.
const codeHref = computed(() =>
  experiment.value ? codeUrl(experiment.value.model.display_name) : null,
)
const weightsHref = computed(() =>
  experiment.value
    ? weightsUrl(
        experiment.value.model.display_name,
        experiment.value.transfer_source,
        experiment.value.split,
      )
    : null,
)

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
    error.value = err instanceof Error ? err.message : t('experiment.loadError')
  } finally {
    loading.value = false
  }
}

onMounted(load)
// Refetch when navigating directly between detail pages (same component reused).
watch(() => props.id, load)
</script>

<template>
  <main class="container detail">
    <RouterLink class="back" :to="{ name: 'metrics' }">{{ t('experiment.back') }}</RouterLink>

    <div v-if="loading" class="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>{{ t('common.loading') }}</span>
    </div>

    <p v-else-if="error" class="error">
      {{ error }}
      <button type="button" class="btn btn-secondary btn-sm" @click="load">{{ t('common.retry') }}</button>
    </p>

    <template v-else-if="experiment">
      <h1>{{ modelName(experiment.model.display_name) }}</h1>
      <p class="setup">
        <span>{{ transfer(experiment.transfer_source) }}</span>
        <span class="sep">·</span>
        <span>{{ experiment.split }}</span>
      </p>

      <div v-if="codeHref || weightsHref" class="links">
        <a
          v-if="weightsHref"
          class="btn btn-primary btn-sm"
          :href="weightsHref"
          target="_blank"
          rel="noopener"
        >
          {{ t('experiment.weightsLink') }} ↗
        </a>
        <a
          v-if="codeHref"
          class="btn btn-secondary btn-sm"
          :href="codeHref"
          target="_blank"
          rel="noopener"
        >
          {{ t('experiment.codeLink') }} ↗
        </a>
      </div>

      <figure class="arch">
        <p v-if="imageFailed" class="error">{{ t('experiment.imageFailed') }}</p>
        <img
          v-else
          :src="experimentArchitectureUrl(experiment.id)"
          :alt="`Architecture diagram for ${experiment.model.display_name}`"
          @error="imageFailed = true"
        />
        <figcaption>{{ t('experiment.architecture') }}</figcaption>
      </figure>

      <h2>{{ t('experiment.metricsHeading') }}</h2>
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
  padding-block: 2rem;
}

.back {
  display: inline-block;
  margin-bottom: 1rem;
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 600;
}

.back:hover {
  color: var(--text);
}

h1 {
  color: var(--text);
  margin-bottom: 0.25rem;
}

.setup {
  color: var(--text-muted);
  font-weight: 600;
  margin-top: 0;
}

.setup .sep {
  margin: 0 0.5rem;
  color: var(--border);
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 1rem;
}

.links a {
  text-decoration: none;
}

.arch {
  margin: 1.5rem 0;
}

.arch img {
  width: 100%;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.arch figcaption {
  margin-top: 0.5rem;
  color: var(--text-muted);
  font-size: 0.9rem;
  text-align: center;
}

h2 {
  color: var(--text);
}

.scores {
  margin: 0;
}

.score {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}

.score:last-child {
  border-bottom: none;
}

.score dt {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-weight: 600;
  color: var(--text);
}

.score .value {
  font-variant-numeric: tabular-nums;
}

.score dd {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.95rem;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
}
</style>
