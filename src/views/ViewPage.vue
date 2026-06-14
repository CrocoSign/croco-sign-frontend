<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getSegmentFilters, listSegments } from '@/api/client'
import type { SegmentFacets, SegmentFilters, SegmentSummary } from '@/api/types'

const router = useRouter()

// Open a segment's detail page.
function openSegment(id: number) {
  router.push({ name: 'segment', params: { id } })
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200]
const SKELETON_ROWS = 8
const SEARCH_DEBOUNCE_MS = 300

const segments = ref<SegmentSummary[]>([])
const total = ref(0)
const pageSize = ref(50)
const loading = ref(false) // a fetch is in flight
const initialLoading = ref(false) // first load / after page-size change (drives skeleton)
const error = ref<string | null>(null)

// Filters. `sentenceInput` is what the user types; `sentence` is its debounced
// value so we don't refetch on every keystroke. The facets populate the dropdowns.
const facets = ref<SegmentFacets>({ ages: [], sexes: [], speaker_ids: [] })
// Multi-select checkbox groups: each holds the values currently ticked.
const ages = ref<string[]>([])
const sexes = ref<string[]>([])
const speakerIds = ref<string[]>([])
const sentenceInput = ref('')
const sentence = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(sentenceInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    sentence.value = value.trim()
  }, SEARCH_DEBOUNCE_MS)
})

const filters = computed<SegmentFilters>(() => ({
  age: ages.value,
  sex: sexes.value,
  speaker_id: speakerIds.value,
  sentence: sentence.value || undefined,
}))

// More rows exist as long as we've loaded fewer than the server's total.
const hasMore = computed(() => segments.value.length < total.value)
// Show the end-of-list note once we have rows and there's nothing left to fetch.
const reachedEnd = computed(() => !initialLoading.value && segments.value.length > 0 && !hasMore.value)

const scrollRoot = ref<HTMLElement | null>(null)
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// Fetch the next page from the current offset and append it.
async function loadMore() {
  if (loading.value || (!hasMore.value && segments.value.length > 0)) {
    return
  }
  loading.value = true
  error.value = null
  try {
    const page = await listSegments(pageSize.value, segments.value.length, filters.value)
    segments.value.push(...page.items)
    total.value = page.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load segments.'
  } finally {
    loading.value = false
    initialLoading.value = false
  }
}

// Restart the list from offset 0 (initial mount and whenever page size changes).
async function reset() {
  segments.value = []
  total.value = 0
  error.value = null
  initialLoading.value = true
  await loadMore()
}

// Any page-size or filter change restarts the list from offset 0.
watch([pageSize, filters], reset)

onMounted(async () => {
  // Non-fatal: if facets fail to load the dropdowns stay empty but the list works.
  try {
    facets.value = await getSegmentFilters()
  } catch {
    // ignore — leave dropdowns empty
  }
  reset()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value && !loading.value) {
        loadMore()
      }
    },
    { root: scrollRoot.value, rootMargin: '120px' },
  )
  if (sentinel.value) {
    observer.observe(sentinel.value)
  }
})

onUnmounted(() => {
  observer?.disconnect()
  observer = null
  clearTimeout(searchTimer)
})
</script>

<template>
  <main class="view">
    <h1>Segments</h1>
    <p class="subtitle">Browse the dataset of sign-language segments.</p>

    <!-- Fixed header area; filters live here, above the scroll region. -->
    <div class="toolbar">
      <div class="filters">
        <fieldset class="filter">
          <legend>Sex</legend>
          <div class="options">
            <label v-for="value in facets.sexes" :key="value" class="check">
              <input type="checkbox" :value="value" v-model="sexes" />
              <span>{{ value }}</span>
            </label>
          </div>
        </fieldset>
        <fieldset class="filter">
          <legend>Age</legend>
          <div class="options">
            <label v-for="value in facets.ages" :key="value" class="check">
              <input type="checkbox" :value="value" v-model="ages" />
              <span>{{ value }}</span>
            </label>
          </div>
        </fieldset>
        <fieldset class="filter">
          <legend>Signer</legend>
          <div class="options options--scroll">
            <label v-for="value in facets.speaker_ids" :key="value" class="check">
              <input type="checkbox" :value="value" v-model="speakerIds" />
              <span>{{ value }}</span>
            </label>
          </div>
        </fieldset>
        <label class="filter filter--search">
          <span class="filter-title">Search</span>
          <input v-model="sentenceInput" type="search" placeholder="Sentence text…" />
        </label>
      </div>
    </div>

    <div class="toolbar toolbar--secondary">
      <label class="page-size">
        <span>Show</span>
        <select v-model.number="pageSize">
          <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">{{ size }}</option>
        </select>
        <span>per load</span>
      </label>
      <span v-if="total > 0" class="count">{{ segments.length }} of {{ total }}</span>
    </div>

    <div ref="scrollRoot" class="records">
      <table class="segments">
        <thead>
          <tr>
            <th class="col-id">Segment ID</th>
            <th>Sentence</th>
            <th class="col-signer">Signer</th>
            <th class="col-narrow">Age</th>
            <th class="col-narrow">Sex</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="seg in segments" :key="seg.id" class="row" @click="openSegment(seg.id)">
            <td class="col-id">
              <RouterLink :to="{ name: 'segment', params: { id: seg.id } }" @click.stop>
                {{ seg.segment_id }}
              </RouterLink>
            </td>
            <td>{{ seg.sentence }}</td>
            <td class="col-signer">{{ seg.speaker_id }}</td>
            <td class="col-narrow">{{ seg.age }}</td>
            <td class="col-narrow">{{ seg.sex }}</td>
          </tr>

          <!-- Skeleton placeholders during the very first load. -->
          <template v-if="initialLoading">
            <tr v-for="n in SKELETON_ROWS" :key="`sk-${n}`" class="skeleton-row">
              <td><span class="skeleton" /></td>
              <td><span class="skeleton" /></td>
              <td class="col-signer"><span class="skeleton" /></td>
              <td class="col-narrow"><span class="skeleton skeleton--sm" /></td>
              <td class="col-narrow"><span class="skeleton skeleton--sm" /></td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Empty state once the first load finishes with no rows. -->
      <p v-if="!initialLoading && segments.length === 0 && !error" class="empty">No segments found.</p>

      <!-- "Loading more" footer for subsequent pages. -->
      <div v-if="loading && segments.length > 0" class="footer">
        <span class="spinner" aria-hidden="true"></span>
        <span>Loading more…</span>
      </div>

      <p v-else-if="reachedEnd" class="footer footer--muted">You've reached the end · {{ total }} segments.</p>

      <p v-if="error" class="footer error">
        {{ error }}
        <button type="button" @click="loadMore">Retry</button>
      </p>

      <!-- Infinite-scroll trigger; sits at the bottom of the scroll region. -->
      <div ref="sentinel" class="sentinel" aria-hidden="true"></div>
    </div>
  </main>
</template>

<style scoped>
.view {
  max-width: 60rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.subtitle {
  color: #666;
  margin-top: 0.25rem;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 1.5rem 0 0.75rem;
  flex-wrap: wrap;
}

.toolbar--secondary {
  margin: 0 0 0.75rem;
}

.filters {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.filter {
  display: inline-flex;
  flex-direction: column;
  gap: 0.4rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #2c3e50;
}

/* Checkbox groups are <fieldset>s; strip the default chrome. */
fieldset.filter {
  border: 1px solid #e3e6ea;
  border-radius: 0.5rem;
  padding: 0.4rem 0.7rem 0.6rem;
  margin: 0;
}

fieldset.filter legend {
  padding: 0 0.3rem;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.85rem;
}

.options--scroll {
  flex-wrap: nowrap;
  flex-direction: column;
  max-height: 7rem;
  overflow-y: auto;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 400;
  cursor: pointer;
  white-space: nowrap;
}

.filter-title {
  font-weight: 600;
}

.filter--search input {
  padding: 0.3rem 0.5rem;
  font-size: 1rem;
  font-weight: 400;
  border: 1px solid #ccd2d8;
  border-radius: 0.25rem;
  min-width: 14rem;
}

.page-size {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.page-size select {
  padding: 0.3rem 0.5rem;
  font-size: 1rem;
}

.count {
  color: #666;
  font-size: 0.9rem;
}

.records {
  max-height: 70vh;
  overflow-y: auto;
  border: 1px solid #e3e6ea;
  border-radius: 0.5rem;
}

.segments {
  width: 100%;
  border-collapse: collapse;
}

.segments th,
.segments td {
  text-align: left;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid #eef1f4;
  vertical-align: top;
}

.segments thead th {
  position: sticky;
  top: 0;
  background: #f4f6f8;
  color: #2c3e50;
  z-index: 1;
}

.col-id {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.col-signer {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.col-narrow {
  width: 4rem;
  white-space: nowrap;
}

.segments tbody tr.row {
  cursor: pointer;
}

.segments tbody tr:hover {
  background: #f9fafb;
}

.col-id a {
  color: #2c3e50;
  text-decoration: none;
  font-weight: 600;
}

.col-id a:hover {
  text-decoration: underline;
}

/* Skeleton loading rows */
.skeleton {
  display: block;
  height: 0.85rem;
  border-radius: 0.25rem;
  background: linear-gradient(90deg, #eceff2 25%, #f5f7f9 37%, #eceff2 63%);
  background-size: 400% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}

.skeleton--sm {
  width: 2rem;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
}

.empty {
  padding: 2rem;
  text-align: center;
  color: #666;
}

.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  color: #666;
}

.footer--muted {
  color: #999;
  font-size: 0.9rem;
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

.sentinel {
  height: 1px;
}
</style>
