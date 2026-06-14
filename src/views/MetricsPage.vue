<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getMetrics } from '@/api/client'
import type { ExperimentRow, MetricsTable } from '@/api/types'

const router = useRouter()

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
    error.value = err instanceof Error ? err.message : 'Failed to load metrics.'
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
  <main class="metrics">
    <h1>Benchmark metrics</h1>

    <div v-if="loading" class="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading…</span>
    </div>

    <p v-else-if="error" class="error">
      {{ error }}
      <button type="button" @click="load">Retry</button>
    </p>

    <template v-else-if="table">
      <section v-for="group in groups" :key="group.model.id" class="group">
        <h2>{{ group.model.display_name }}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="left">Transfer source</th>
                <th class="left">Split</th>
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
                <td class="left">{{ row.transfer_source }}</td>
                <td class="left">{{ row.split }}</td>
                <td v-for="name in metricNames" :key="name">
                  {{ row.scores[name] ?? '—' }}
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
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}

h1 {
  color: #2c3e50;
}

.group {
  margin-top: 2rem;
}

.group h2 {
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #e3e6ea;
  border-radius: 0.5rem;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

thead th {
  background: #f4f6f8;
  color: #2c3e50;
  font-weight: 600;
  text-align: right;
  padding: 0.6rem 0.85rem;
  white-space: nowrap;
  border-bottom: 1px solid #e3e6ea;
}

td {
  padding: 0.55rem 0.85rem;
  text-align: right;
  color: #444;
  border-bottom: 1px solid #f0f2f5;
  white-space: nowrap;
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
  background: #f4f6f8;
  outline: none;
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
