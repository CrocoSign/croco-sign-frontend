import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/translate' },
    {
      path: '/translate',
      name: 'translate',
      component: () => import('@/views/TranslatePage.vue'),
    },
  ],
})

export default router
