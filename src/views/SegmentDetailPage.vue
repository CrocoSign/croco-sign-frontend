<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getSegment, segmentVideoUrl } from '@/api/client'
import type { SegmentDetail } from '@/api/types'

const props = defineProps<{ id: string }>()

const router = useRouter()

function translateSegment() {
  if (!segment.value) return
  router.push({ name: 'translate', query: { segmentId: String(segment.value.id) } })
}

const segment = ref<SegmentDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const videoFailed = ref(false)

async function load() {
  loading.value = true
  error.value = null
  videoFailed.value = false
  segment.value = null
  try {
    segment.value = await getSegment(Number(props.id))
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load segment.'
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
    <RouterLink class="back" :to="{ name: 'view' }">← Back to segments</RouterLink>

    <div v-if="loading" class="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading…</span>
    </div>

    <p v-else-if="error" class="error">
      {{ error }}
      <button type="button" @click="load">Retry</button>
    </p>

    <template v-else-if="segment">
      <h1>{{ segment.segment_id }}</h1>
      <p class="sentence">{{ segment.sentence }}</p>

      <p v-if="videoFailed" class="error">Couldn't load the video clip for this segment.</p>
      <video
        v-else
        class="player"
        controls
        :src="segmentVideoUrl(segment.id)"
        @error="videoFailed = true"
      ></video>

      <button type="button" class="translate-btn" @click="translateSegment">
        Translate this segment
      </button>

      <dl class="meta">
        <dt>Signer sex</dt>
        <dd>{{ segment.video_metadata.signer.sex }}</dd>

        <dt>Signer age</dt>
        <dd>{{ segment.video_metadata.signer.age }}</dd>

        <dt>Special case</dt>
        <dd>{{ segment.video_metadata.signer.special_case }}</dd>

        <dt>Speaker side</dt>
        <dd>{{ segment.video_metadata.speaker_side }}</dd>

        <dt>Video type</dt>
        <dd>{{ segment.video_metadata.video_type }}</dd>

        <dt>Video ID</dt>
        <dd>{{ segment.video_metadata.video_id }}</dd>

        <dt>Task ID</dt>
        <dd>{{ segment.video_metadata.task_id }}</dd>

        <dt>Source</dt>
        <dd class="links">
          <a :href="segment.video_metadata.video_url" target="_blank" rel="noopener">video ↗</a>
          <a :href="segment.video_metadata.subtitles_url" target="_blank" rel="noopener">
            subtitles ↗
          </a>
        </dd>
      </dl>
    </template>
  </main>
</template>

<style scoped>
.detail {
  max-width: 48rem;
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

.sentence {
  padding: 1rem;
  background: #f4f6f8;
  border-radius: 0.5rem;
  white-space: pre-wrap;
  font-size: 1.1rem;
}

.player {
  width: 100%;
  max-height: 70vh;
  margin: 1rem 0;
  background: #000;
  border-radius: 0.5rem;
}

.translate-btn {
  padding: 0.5rem 1.25rem;
  font-size: 1rem;
  color: #fff;
  background: #2c3e50;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
}

.translate-btn:hover {
  opacity: 0.9;
}

.meta {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
  margin-top: 1.5rem;
}

.meta dt {
  font-weight: 600;
  color: #2c3e50;
}

.meta dd {
  margin: 0;
  color: #444;
}

.links {
  display: flex;
  gap: 1.5rem;
}

.links a {
  color: #2c3e50;
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
