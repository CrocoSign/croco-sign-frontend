<script setup lang="ts"></script>

<template>
  <header class="nav">
    <nav class="nav__links">
      <RouterLink to="/translate">Translate</RouterLink>
      <RouterLink to="/view">View</RouterLink>
    </nav>
  </header>
  <RouterView />
</template>

<style scoped>
.nav {
  border-bottom: 1px solid #e3e6ea;
  background: #fff;
}

.nav__links {
  display: flex;
  gap: 1.5rem;
  max-width: 60rem;
  margin: 0 auto;
  padding: 0.85rem 1rem;
}

.nav__links a {
  color: #666;
  text-decoration: none;
  font-weight: 600;
  padding-bottom: 0.15rem;
  border-bottom: 2px solid transparent;
}

.nav__links a:hover {
  color: #2c3e50;
}

.nav__links a.router-link-active {
  color: #2c3e50;
  border-bottom-color: #2c3e50;
}
</style>
