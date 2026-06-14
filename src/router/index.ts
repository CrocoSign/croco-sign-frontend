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
    {
      path: '/view',
      name: 'view',
      component: () => import('@/views/ViewPage.vue'),
    },
    {
      path: '/view/:id',
      name: 'segment',
      component: () => import('@/views/SegmentDetailPage.vue'),
      props: true,
    },
    {
      path: '/metrics',
      name: 'metrics',
      component: () => import('@/views/MetricsPage.vue'),
    },
    {
      path: '/metrics/:id',
      name: 'experiment',
      component: () => import('@/views/ExperimentDetailPage.vue'),
      props: true,
    },
  ],
})

export default router
