import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'

import ExperimentDetailPage from '../views/ExperimentDetailPage.vue'
import i18n from '@/i18n'
import type { ExperimentDetail } from '@/api/types'

vi.mock('@/api/client', () => ({
  getExperiment: vi.fn<typeof import('@/api/client').getExperiment>(),
  experimentArchitectureUrl: (id: number) =>
    `http://localhost:8000/experiments/${id}/architecture`,
}))

import { getExperiment } from '@/api/client'

const experiment: ExperimentDetail = {
  id: 3,
  transfer_source: 'brak (od zera)',
  split: 'MS',
  model: { id: 1, display_name: 'SpaMo (modyf.)' },
  scores: [
    { metric: { id: 1, name: 'BLEU-4', description: 'N-gram precision.' }, value: 5.54 },
    { metric: { id: 2, name: 'ROUGE-L', description: 'F-measure over the LCS.' }, value: 19.66 },
  ],
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/metrics', name: 'metrics', component: { template: '<div />' } },
      { path: '/metrics/:id', name: 'experiment', component: ExperimentDetailPage, props: true },
    ],
  })
}

async function mountPage(id = '3') {
  const router = makeRouter()
  router.push('/metrics')
  await router.isReady()
  const wrapper = mount(ExperimentDetailPage, { props: { id }, global: { plugins: [router] } })
  return { wrapper, router }
}

beforeEach(() => {
  vi.mocked(getExperiment).mockReset()
})

afterEach(() => {
  i18n.global.locale.value = 'en'
})

describe('ExperimentDetailPage', () => {
  it('renders the model, setup and metric scores after loading', async () => {
    let resolve!: (e: ExperimentDetail) => void
    vi.mocked(getExperiment).mockReturnValue(new Promise((r) => (resolve = r)))
    const { wrapper } = await mountPage()
    expect(wrapper.find('.spinner').exists()).toBe(true)

    resolve(experiment)
    await flushPromises()

    // English localization of the model name.
    expect(wrapper.find('h1').text()).toBe('SpaMo (mod.)')
    expect(wrapper.find('.setup').text()).toContain('none (from scratch)')
    expect(wrapper.find('.setup').text()).toContain('MS')

    const scores = wrapper.findAll('.score')
    expect(scores).toHaveLength(2)
    expect(scores[0]!.find('.name').text()).toBe('BLEU-4')
    expect(scores[0]!.find('.value').text()).toBe('5.54')
    expect(scores[0]!.find('dd').text()).toBe('N-gram precision.')
  })

  it('localizes labels for the active locale', async () => {
    i18n.global.locale.value = 'pl'
    vi.mocked(getExperiment).mockResolvedValue(experiment)
    const { wrapper } = await mountPage()
    await flushPromises()

    expect(wrapper.find('h1').text()).toBe('SpaMo (modyf.)')
    expect(wrapper.find('.setup').text()).toContain('brak (od zera)')
  })

  it('renders code and weights links with the right hrefs', async () => {
    vi.mocked(getExperiment).mockResolvedValue(experiment)
    const { wrapper } = await mountPage()
    await flushPromises()

    const links = wrapper.findAll('.links a')
    expect(links).toHaveLength(2)
    const hrefs = links.map((a) => a.attributes('href'))
    expect(hrefs).toContain('https://github.com/croco-corp/spaMo-PJM')
    expect(hrefs).toContain(
      'https://huggingface.co/croco-corp/pjm-models/tree/main/spamo/mod-spamo-pjm-scratch-ms',
    )
    expect(links[0]!.attributes('target')).toBe('_blank')
    expect(links[0]!.attributes('rel')).toBe('noopener')
  })

  it('omits the links block for an unknown model', async () => {
    vi.mocked(getExperiment).mockResolvedValue({
      ...experiment,
      model: { id: 9, display_name: 'Mystery' },
    })
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.find('.links').exists()).toBe(false)
  })

  it('shows the architecture image and a fallback on error', async () => {
    vi.mocked(getExperiment).mockResolvedValue(experiment)
    const { wrapper } = await mountPage()
    await flushPromises()

    const img = wrapper.find('.arch img')
    expect(img.attributes('src')).toBe('http://localhost:8000/experiments/3/architecture')

    await img.trigger('error')
    expect(wrapper.find('.arch img').exists()).toBe(false)
    expect(wrapper.find('.arch .error').text()).toContain("Couldn't load the architecture diagram")
  })

  it('shows an error and retries', async () => {
    vi.mocked(getExperiment).mockRejectedValueOnce(new Error('missing'))
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.find('.error').text()).toContain('missing')

    vi.mocked(getExperiment).mockResolvedValueOnce(experiment)
    await wrapper.find('.error button').trigger('click')
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('SpaMo (mod.)')
  })

  it('refetches when the id prop changes', async () => {
    vi.mocked(getExperiment).mockResolvedValue(experiment)
    const { wrapper } = await mountPage('3')
    await flushPromises()
    expect(vi.mocked(getExperiment)).toHaveBeenCalledWith(3)

    await wrapper.setProps({ id: '4' })
    await flushPromises()
    expect(vi.mocked(getExperiment)).toHaveBeenCalledWith(4)
  })

  it('links back to the metrics page', async () => {
    vi.mocked(getExperiment).mockResolvedValue(experiment)
    const { wrapper } = await mountPage()
    await flushPromises()
    expect(wrapper.find('a.back').attributes('href')).toBe('/metrics')
  })
})
