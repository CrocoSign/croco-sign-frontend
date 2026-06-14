import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

import MetricsPage from '../views/MetricsPage.vue'
import type { MetricsTable } from '@/api/types'

// Mock the API client so tests don't hit the network.
vi.mock('@/api/client', () => ({
  getMetrics: vi.fn<typeof import('@/api/client').getMetrics>(),
}))

// Mock the router so row clicks can be asserted.
const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}))

import { getMetrics } from '@/api/client'

const table: MetricsTable = {
  metrics: [
    { id: 1, name: 'BLEU-4', description: 'N-gram precision for n=4.' },
    { id: 2, name: 'ROUGE-L', description: 'F-measure over the LCS.' },
  ],
  experiments: [
    {
      id: 10,
      model: { id: 1, display_name: 'SpaMo' },
      transfer_source: 'PHOENIX',
      split: 'MS',
      scores: { 'BLEU-4': 5.54, 'ROUGE-L': 19.66 },
    },
    {
      id: 11,
      model: { id: 1, display_name: 'SpaMo' },
      transfer_source: 'brak (tylko PJM)',
      split: 'SI',
      scores: { 'BLEU-4': 0.93, 'ROUGE-L': 9.28 },
    },
    {
      id: 12,
      model: { id: 2, display_name: 'Uni-Sign' },
      transfer_source: 'How2Sign',
      split: 'MS',
      scores: { 'BLEU-4': 7.61, 'ROUGE-L': 19.71 },
    },
  ],
}

describe('MetricsPage', () => {
  beforeEach(() => {
    vi.mocked(getMetrics).mockReset()
    push.mockReset()
  })

  it('renders one group per model with the metric columns', async () => {
    vi.mocked(getMetrics).mockResolvedValue(table)
    const wrapper = mount(MetricsPage)
    await flushPromises()

    const groups = wrapper.findAll('section.group')
    expect(groups).toHaveLength(2)
    expect(groups[0]!.find('h2').text()).toBe('SpaMo')
    expect(groups[1]!.find('h2').text()).toBe('Uni-Sign')

    // Header columns: Transfer source, Split, then each metric name.
    const headers = groups[0]!.findAll('thead th').map((th) => th.text())
    expect(headers).toEqual(['Transfer source', 'Split', 'BLEU-4', 'ROUGE-L'])

    // SpaMo has two experiment rows, Uni-Sign one.
    expect(groups[0]!.findAll('tbody tr')).toHaveLength(2)
    expect(groups[1]!.findAll('tbody tr')).toHaveLength(1)
  })

  it('navigates to the experiment page when a row is clicked', async () => {
    vi.mocked(getMetrics).mockResolvedValue(table)
    const wrapper = mount(MetricsPage)
    await flushPromises()

    await wrapper.find('tbody tr').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'experiment', params: { id: '10' } })
  })

  it('shows an error and retries', async () => {
    vi.mocked(getMetrics).mockRejectedValueOnce(new Error('boom'))
    const wrapper = mount(MetricsPage)
    await flushPromises()

    expect(wrapper.find('.error').text()).toContain('boom')

    vi.mocked(getMetrics).mockResolvedValueOnce(table)
    await wrapper.find('.error button').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('section.group')).toHaveLength(2)
  })
})
