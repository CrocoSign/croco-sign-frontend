<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { getSegment, segmentVideoUrl } from '@/api/client'
import type { SegmentDetail } from '@/api/types'
import { localizeSex, localizeSpeakerSide } from '@/i18n/dataLabels'
import type { AppLocale } from '@/i18n'

const props = defineProps<{ id: string }>()

const router = useRouter()
const { t, locale } = useI18n()

const speakerSide = (v: string) => localizeSpeakerSide(v, locale.value as AppLocale)
const sex = (v: string) => localizeSex(v, locale.value as AppLocale)

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
    error.value = err instanceof Error ? err.message : t('segment.loadError')
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
    <RouterLink class="back" :to="{ name: 'view' }">{{ t('segment.back') }}</RouterLink>

    <div v-if="loading" class="status">
      <span class="spinner" aria-hidden="true"></span>
      <span>{{ t('common.loading') }}</span>
    </div>

    <p v-else-if="error" class="error">
      {{ error }}
      <button type="button" @click="load">{{ t('common.retry') }}</button>
    </p>

    <template v-else-if="segment">
      <h1>{{ segment.segment_id }}</h1>
      <p class="sentence">{{ segment.sentence }}</p>

      <p v-if="videoFailed" class="error">{{ t('segment.videoFailed') }}</p>
      <video
        v-else
        class="player"
        controls
        :src="segmentVideoUrl(segment.id)"
        @error="videoFailed = true"
      ></video>

      <button type="button" class="translate-btn btn btn-primary" @click="translateSegment">
        {{ t('segment.translateBtn') }}
      </button>

      <dl class="meta">
        <dt>{{ t('segment.meta.signerSex') }}</dt>
        <dd>{{ sex(segment.video_metadata.signer.sex) }}</dd>

        <dt>{{ t('segment.meta.signerAge') }}</dt>
        <dd>{{ segment.video_metadata.signer.age }}</dd>

        <dt>{{ t('segment.meta.specialCase') }}</dt>
        <dd>{{ segment.video_metadata.signer.special_case }}</dd>

        <dt>{{ t('segment.meta.speakerSide') }}</dt>
        <dd>{{ speakerSide(segment.video_metadata.speaker_side) }}</dd>

        <dt>{{ t('segment.meta.videoType') }}</dt>
        <dd>{{ segment.video_metadata.video_type }}</dd>

        <dt>{{ t('segment.meta.videoId') }}</dt>
        <dd>{{ segment.video_metadata.video_id }}</dd>

        <dt>{{ t('segment.meta.taskId') }}</dt>
        <dd>{{ segment.video_metadata.task_id }}</dd>

        <dt>{{ t('segment.meta.source') }}</dt>
        <dd class="links">
          <a :href="segment.video_metadata.video_url" target="_blank" rel="noopener">{{
            t('segment.videoLink')
          }}</a>
          <a :href="segment.video_metadata.subtitles_url" target="_blank" rel="noopener">
            {{ t('segment.subtitlesLink') }}
          </a>
        </dd>
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

.sentence {
  padding: 1rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  white-space: pre-wrap;
  font-size: 1.1rem;
}

.player {
  width: 100%;
  max-height: 70vh;
  margin: 1rem 0;
  background: #000;
  border-radius: var(--radius);
}

.translate-btn {
  margin-top: 0.5rem;
}

.meta {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.5rem;
  margin-top: 1.5rem;
}

.meta dt {
  font-weight: 600;
  color: var(--text);
}

.meta dd {
  margin: 0;
  color: var(--text-muted);
}

.links {
  display: flex;
  gap: 1.5rem;
}

.links a {
  color: var(--text);
}

.status {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
}

.error button {
  margin-left: 0.5rem;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
}
</style>
