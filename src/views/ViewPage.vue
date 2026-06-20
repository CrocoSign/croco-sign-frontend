<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getSegmentFilters, listSegments } from '@/api/client'
import type { SegmentFacets, SegmentFilters, SegmentSummary } from '@/api/types'
import { localizeSex } from '@/i18n/dataLabels'
import type { AppLocale } from '@/i18n'

const router = useRouter()
const { t, locale } = useI18n()

const sex = (v: string) => localizeSex(v, locale.value as AppLocale)

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
    error.value = err instanceof Error ? err.message : t('view.loadError')
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
    // ignore - leave dropdowns empty
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
  <main class="container view">
    <header class="view__head">
      <h1>{{ t('view.title') }}</h1>
      <p class="subtitle">{{ t('view.subtitle') }}</p>
    </header>

    <!-- Fixed header area; filters live here, above the scroll region. -->
    <div class="toolbar card">
      <div class="filters">
        <fieldset class="filter">
          <legend>{{ t('view.filterSex') }}</legend>
          <div class="options">
            <label v-for="value in facets.sexes" :key="value" class="check">
              <input type="checkbox" :value="value" v-model="sexes" />
              <span>{{ sex(value) }}</span>
            </label>
          </div>
        </fieldset>
        <fieldset class="filter">
          <legend>{{ t('view.filterAge') }}</legend>
          <div class="options">
            <label v-for="value in facets.ages" :key="value" class="check">
              <input type="checkbox" :value="value" v-model="ages" />
              <span>{{ value }}</span>
            </label>
          </div>
        </fieldset>
        <fieldset class="filter">
          <legend>{{ t('view.filterSigner') }}</legend>
          <div class="options options--scroll">
            <label v-for="value in facets.speaker_ids" :key="value" class="check">
              <input type="checkbox" :value="value" v-model="speakerIds" />
              <span>{{ value }}</span>
            </label>
          </div>
        </fieldset>
        <label class="filter filter--search">
          <span class="filter-title">{{ t('view.search') }}</span>
          <input v-model="sentenceInput" type="search" :placeholder="t('view.searchPlaceholder')" />
        </label>
      </div>
    </div>

    <div class="toolbar toolbar--secondary">
      <label class="page-size">
        <span>{{ t('view.show') }}</span>
        <select v-model.number="pageSize">
          <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">{{ size }}</option>
        </select>
        <span>{{ t('view.perLoad') }}</span>
      </label>
      <span v-if="total > 0" class="count">{{ t('view.countOf', { loaded: segments.length, total }) }}</span>
    </div>

    <div ref="scrollRoot" class="records card">
      <table class="segments">
        <thead>
          <tr>
            <th class="col-id">{{ t('view.colId') }}</th>
            <th>{{ t('view.colSentence') }}</th>
            <th class="col-signer">{{ t('view.colSigner') }}</th>
            <th class="col-narrow">{{ t('view.colAge') }}</th>
            <th class="col-narrow">{{ t('view.colSex') }}</th>
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
            <td class="col-narrow">{{ sex(seg.sex) }}</td>
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
      <p v-if="!initialLoading && segments.length === 0 && !error" class="empty">{{ t('view.empty') }}</p>

      <!-- "Loading more" footer for subsequent pages. -->
      <div v-if="loading && segments.length > 0" class="footer">
        <span class="spinner" aria-hidden="true"></span>
        <span>{{ t('view.loadingMore') }}</span>
      </div>

      <p v-else-if="reachedEnd" class="footer footer--muted">{{ t('view.reachedEnd', { total }) }}</p>

      <p v-if="error" class="footer error">
        {{ error }}
        <button type="button" class="btn btn-secondary btn-sm" @click="loadMore">{{ t('common.retry') }}</button>
      </p>

      <!-- Infinite-scroll trigger; sits at the bottom of the scroll region. -->
      <div ref="sentinel" class="sentinel" aria-hidden="true"></div>
    </div>
  </main>
</template>

<style scoped>
.view {
  padding-block: 2rem;
}

.view__head {
  margin-bottom: 1.5rem;
}

.subtitle {
  color: var(--text-muted);
  margin-top: 0.35rem;
}

/* Shared card style → consistent with the rest of the app. */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 1.25rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.toolbar--secondary {
  padding: 0;
  margin: 0 0 0.85rem;
  border: none;
  box-shadow: none;
  background: transparent;
}

.filters {
  display: flex;
  align-items: flex-start;
  gap: 0.85rem;
  flex-wrap: wrap;
}

/* Each filter group: small caps label + a row of chip toggles. */
.filter {
  display: inline-flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  border: 0;
  min-inline-size: 0;
}

.filter legend,
.filter-title {
  padding: 0;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.options--scroll {
  max-height: 8.5rem;
  overflow-y: auto;
  padding-right: 0.2rem;
}

/* Native checkbox hidden; the label renders as a pill toggle. */
.check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition:
    background-color 0.12s ease,
    border-color 0.12s ease,
    color 0.12s ease;
}

.check input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.check:hover {
  border-color: var(--text-muted);
}

.check:has(input:checked) {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

.check:has(input:focus-visible) {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}

.filter--search input {
  padding: 0.45rem 0.85rem;
  font-size: 0.95rem;
  font-weight: 400;
  border: 1px solid var(--border);
  border-radius: 999px;
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
  color: var(--text-muted);
  font-size: 0.9rem;
}

.records {
  max-height: 70vh;
  overflow: auto;
  /* border, radius, surface and shadow come from .card */
}

.segments {
  width: 100%;
  border-collapse: collapse;
}

.segments th,
.segments td {
  text-align: left;
  padding: 0.6rem 0.85rem;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.segments thead th {
  position: sticky;
  top: 0;
  background: var(--surface-2);
  color: var(--text);
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
  background: var(--primary-soft);
}

.col-id a {
  color: var(--text);
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
  border-radius: var(--radius-sm);
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border) 37%, var(--surface-2) 63%);
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
  color: var(--text-muted);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  color: var(--text-muted);
}

.footer--muted {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.error button {
  margin-left: 0.5rem;
}

.sentinel {
  height: 1px;
}

/* ---- Mobile ---- */
@media (max-width: 36rem) {
  .toolbar {
    padding: 0.9rem 1rem;
  }

  .filter--search {
    width: 100%;
  }

  .filter--search input {
    width: 100%;
    min-width: 0;
  }

  .segments th,
  .segments td {
    padding: 0.5rem 0.6rem;
  }
}
</style>
