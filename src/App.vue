<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, type AppLocale } from '@/i18n'
import { useThemeStore } from '@/stores/theme'
import BrandLogo from '@/components/BrandLogo.vue'

const { t, locale } = useI18n()
const theme = useThemeStore()

function switchLocale(value: AppLocale) {
  setLocale(value)
}
</script>

<template>
  <header class="nav">
    <div class="nav__inner container">
      <RouterLink to="/translate" class="brand" :aria-label="t('nav.brand')">
        <BrandLogo />
      </RouterLink>

      <nav class="nav__links">
        <RouterLink to="/translate">{{ t('nav.translate') }}</RouterLink>
        <RouterLink to="/view">{{ t('nav.view') }}</RouterLink>
        <RouterLink to="/metrics">{{ t('nav.metrics') }}</RouterLink>
      </nav>

      <div class="nav__actions">
        <div class="lang" role="group" :aria-label="t('nav.language')">
          <button
            type="button"
            :class="{ 'lang--on': locale === 'pl' }"
            @click="switchLocale('pl')"
          >
            PL
          </button>
          <button
            type="button"
            :class="{ 'lang--on': locale === 'en' }"
            @click="switchLocale('en')"
          >
            EN
          </button>
        </div>

        <button
          type="button"
          class="theme-toggle"
          :title="t('nav.toggleTheme')"
          :aria-label="t('nav.toggleTheme')"
          @click="theme.toggle()"
        >
          {{ theme.resolved === 'dark' ? '☾' : '☀' }}
        </button>
      </div>
    </div>
  </header>

  <RouterView />
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.nav__inner {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding-top: 0.7rem;
  padding-bottom: 0.7rem;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  font-size: 1.1rem;
  color: var(--text);
  text-decoration: none;
}

.brand__mark {
  font-size: 1.25rem;
}

.nav__links {
  display: flex;
  gap: 0.35rem;
  margin-right: auto;
}

/* Neutral chrome: active nav is ink/bold, not green (green is reserved for actions). */
.nav__links a {
  padding: 0.4rem 0.8rem;
  border-radius: 999px;
  color: var(--text-muted);
  text-decoration: none;
  font-weight: 600;
}

.nav__links a:hover {
  color: var(--text);
  background: var(--surface-2);
}

.nav__links a.router-link-active {
  color: var(--text);
  background: var(--surface-2);
}

.nav__actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.lang {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 999px;
  overflow: hidden;
}

.lang button {
  border: none;
  background: var(--surface);
  color: var(--text-muted);
  padding: 0.3rem 0.7rem;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
}

.lang button:hover {
  color: var(--text);
}

.lang button.lang--on {
  background: var(--text);
  color: var(--bg);
}

.theme-toggle {
  width: 2.1rem;
  height: 2.1rem;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  border-radius: 999px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.theme-toggle:hover {
  background: var(--surface-2);
}

/* ---- Mobile: brand + actions on row 1, nav links on row 2 ---- */
@media (max-width: 40rem) {
  .nav__inner {
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
  }

  .brand {
    margin-right: auto;
  }

  .nav__links {
    order: 3;
    width: 100%;
    margin-right: 0;
    justify-content: space-between;
    gap: 0.25rem;
  }

  .nav__links a {
    padding: 0.4rem 0.6rem;
    font-size: 0.95rem;
  }
}
</style>
