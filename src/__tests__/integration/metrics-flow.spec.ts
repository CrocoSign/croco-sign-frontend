import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'

import { apiError, fakeBackend, installFetch, mountApp } from './harness'
import type { ExperimentDetail, MetricsTable } from '@/api/types'

const metrics: MetricsTable = {
  metrics: [
    { id: 1, name: 'BLEU', description: 'BLEU score' },
    { id: 2, name: 'ROUGE', description: 'ROUGE score' },
  ],
  experiments: [
    {
      id: 7,
      model: { id: 1, display_name: 'Uni-Sign' },
      transfer_source: 'openasl',
      split: 'MS',
      scores: { BLEU: 12.3, ROUGE: 45.6 },
    },
  ],
}

const experiment: ExperimentDetail = {
  id: 7,
  transfer_source: 'openasl',
  split: 'MS',
  model: { id: 1, display_name: 'Uni-Sign' },
  scores: [
    { metric: { id: 1, name: 'BLEU', description: 'BLEU score' }, value: 12.3 },
    { metric: { id: 2, name: 'ROUGE', description: 'ROUGE score' }, value: 45.6 },
  ],
}

describe('metrics flow (integration)', () => {
  it('renders the benchmark matrix from GET /metrics', async () => {
    installFetch(fakeBackend({ metrics }))
    const { wrapper } = await mountApp('/metrics')

    const headers = wrapper.findAll('thead th').map((h) => h.text())
    expect(headers).toContain('BLEU')
    expect(headers).toContain('ROUGE')
    expect(wrapper.findAll('tbody tr.row')).toHaveLength(1)
    expect(wrapper.text()).toContain('12.3')
    expect(wrapper.text()).toContain('45.6')
  })

  it('navigates to the experiment detail and loads it when a row is clicked', async () => {
    installFetch(fakeBackend({ metrics, experiments: { 7: experiment } }))
    const { wrapper, router } = await mountApp('/metrics')

    await wrapper.get('tbody tr.row').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('experiment')
    expect(router.currentRoute.value.params.id).toBe('7')
    // ExperimentDetailPage fetched GET /experiments/7 and rendered its scores.
    expect(wrapper.find('h1').text()).toContain('Uni-Sign')
    expect(wrapper.text()).toContain('12.3')
    expect(wrapper.text()).toContain('45.6')
  })

  it('shows the unwrapped error message when GET /metrics fails', async () => {
    installFetch(fakeBackend({ errors: { metrics: apiError('metrics unavailable', 500) } }))
    const { wrapper } = await mountApp('/metrics')

    expect(wrapper.find('.error').text()).toContain('metrics unavailable')
  })
})
