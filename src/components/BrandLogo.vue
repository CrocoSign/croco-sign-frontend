<script setup lang="ts">
// CrocoSign wordmark + mark. Pure SVG/text, theme-aware via CSS tokens.
</script>

<template>
  <span class="logo">
    <svg class="logo__mark" viewBox="0 0 32 32" role="img" aria-label="CrocoSign">
      <rect x="0" y="0" width="32" height="32" rx="8" class="logo__tile" />
      <!-- Open "C" / jaw glyph -->
      <path d="M22.5 9.4 A 8.6 8.6 0 1 0 22.5 22.6" class="logo__glyph" />
      <circle cx="11.3" cy="16" r="1.7" class="logo__eye" />
    </svg>
    <span class="logo__word" aria-hidden="true">
      <span class="logo__croco">Croco</span><span class="logo__sign">Sign</span>
    </span>
  </span>
</template>

<style scoped>
.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  line-height: 1;
}

.logo__mark {
  width: 1.7rem;
  height: 1.7rem;
  display: block;
  flex-shrink: 0;
}

.logo__tile {
  fill: var(--primary);
}

.logo__glyph {
  fill: none;
  stroke: var(--primary-contrast);
  stroke-width: 4.4;
  stroke-linecap: round;
}

.logo__eye {
  fill: var(--primary-contrast);
}

.logo__word {
  font-weight: 800;
  font-size: 1.12rem;
  letter-spacing: -0.01em;
}

.logo__croco {
  color: var(--text);
}

.logo__sign {
  color: var(--primary);
}
</style>
