import { describe, it, expect } from 'vitest'

import router from '@/router'

describe('router', () => {
  it('redirects the root path to /translate', async () => {
    await router.push('/')
    expect(router.currentRoute.value.name).toBe('translate')
    expect(router.currentRoute.value.path).toBe('/translate')
  })

  it('navigates to every section (loads each lazy component)', async () => {
    for (const [path, name] of [
      ['/view', 'view'],
      ['/view/1', 'segment'],
      ['/metrics', 'metrics'],
      ['/metrics/2', 'experiment'],
    ] as const) {
      await router.push(path)
      expect(router.currentRoute.value.name).toBe(name)
    }
  })

  it('resolves the named section routes', () => {
    expect(router.resolve({ name: 'view' }).path).toBe('/view')
    expect(router.resolve({ name: 'metrics' }).path).toBe('/metrics')
    expect(router.resolve({ name: 'translate' }).path).toBe('/translate')
  })

  it('exposes the :id param as a prop on the detail routes', () => {
    const segment = router.resolve('/view/123')
    expect(segment.name).toBe('segment')
    expect(segment.params.id).toBe('123')
    expect(segment.matched[0]!.props.default).toBe(true)

    const experiment = router.resolve('/metrics/9')
    expect(experiment.name).toBe('experiment')
    expect(experiment.params.id).toBe('9')
    expect(experiment.matched[0]!.props.default).toBe(true)
  })
})
