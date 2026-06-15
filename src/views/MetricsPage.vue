<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getMetrics } from '@/api/client'
import type { ExperimentRow, MetricsTable } from '@/api/types'
import type { AppLocale } from '@/i18n'
import { localizeModelName, localizeTransferSource } from '@/i18n/dataLabels'

const router = useRouter()
const { t, locale } = useI18n()

// Localise the few descriptive backend values (proper nouns pass through).
const transfer = (v: string) => localizeTransferSource(v, locale.value as AppLocale)
const modelName = (v: string) => localizeModelName(v, locale.value as AppLocale)

const table = ref<MetricsTable | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// Ordered metric column names, used for both the header and per-row cell lookup.
const metricNames = computed(() => table.value?.metrics.map((m) => m.name) ?? [])

// Experiments grouped by model, preserving the backend's order (model then id).
const groups = computed(() => {
  const result: { model: ExperimentRow['model']; rows: ExperimentRow[] }[] = []
  for (const row of table.value?.experiments ?? []) {
    let group = result.find((g) => g.model.id === row.model.id)
    if (!group) {
      group = { model: row.model, rows: [] }
      result.push(group)
    }
    group.rows.push(row)
  }
  return result
})

async function load() {
  loading.value = true
  error.value = null
  table.value = null
  try {
    table.value = await getMetrics()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('metrics.loadError')
  } finally {
    loading.value = false
  }
}

function openExperiment(id: number) {
  router.push({ name: 'experiment', params: { id: String(id) } })
}

onMounted(load)
</script>

<template>
  <main class="container metrics">
    <h1>{{ t('metrics.title') }}</h1>

    <div class="legend">
      <span class="legend__title">{{ t('metrics.splitLegend') }}</span>
      <span class="legend__item">{{ t('metrics.ms') }}</span>
      <span class="legend__item">{{ t('metrics.si') }}</span>
    </div>

    <div v-if="loading" class="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>{{ t('common.loading') }}</span>
    </div>

    <p v-else-if="error" class="error">
      {{ error }}
      <button type="button" class="btn btn-secondary btn-sm" @click="load">
        {{ t('common.retry') }}
      </button>
    </p>

    <template v-else-if="table">
      <section v-for="group in groups" :key="group.model.id" class="group">
        <h2>{{ modelName(group.model.display_name) }}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="left">{{ t('metrics.transferSource') }}</th>
                <th class="left">{{ t('metrics.split') }}</th>
                <th v-for="name in metricNames" :key="name">{{ name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in group.rows"
                :key="row.id"
                class="row"
                tabindex="0"
                @click="openExperiment(row.id)"
                @keydown.enter="openExperiment(row.id)"
              >
                <td class="left">{{ transfer(row.transfer_source) }}</td>
                <td class="left">{{ row.split }}</td>
                <td v-for="name in metricNames" :key="name">
                  {{ row.scores[name] ?? '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.metrics {
  padding-block: 2rem;
}

h1 {
  color: var(--text);
}

/* MS / SI explanation. */
.legend {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0.85rem 0 0;
  padding: 0.85rem 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.88rem;
  color: var(--text-muted);
}

.legend__title {
  font-weight: 700;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.group {
  margin-top: 2rem;
}

.group h2 {
  color: var(--text);
  margin-bottom: 0.5rem;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

thead th {
  background: var(--surface-2);
  color: var(--text);
  font-weight: 600;
  text-align: right;
  padding: 0.6rem 0.85rem;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
}

td {
  padding: 0.55rem 0.85rem;
  text-align: right;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

td.left {
  color: var(--text-muted);
}

.left {
  text-align: left;
}

tbody tr:last-child td {
  border-bottom: none;
}

.row {
  cursor: pointer;
}

.row:hover,
.row:focus {
  background: var(--primary-soft);
  outline: none;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
}
</style>
