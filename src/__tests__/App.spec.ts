import { afterEach, describe, it, expect } from 'vitest'
import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'

import App from '../App.vue'
import i18n from '@/i18n'

const stubs = {
  RouterView: { template: '<div class="router-view-stub" />' },
  RouterLink: { template: '<a class="router-link-stub"><slot /></a>' },
}

function mountApp() {
  return mount(App, {
    global: {
      plugins: [createPinia()],
      stubs,
    },
  })
}

describe('App', () => {
  afterEach(() => {
    // Restore the suite-wide default locale (tests below switch it).
    i18n.global.locale.value = 'en'
  })

  it('renders the router view', () => {
    const wrapper = mountApp()
    expect(wrapper.find('.router-view-stub').exists()).toBe(true)
  })

  it('switches the active locale when a language button is clicked', async () => {
    const wrapper = mountApp()
    const [pl, en] = wrapper.findAll('.lang button')

    // Starts in English (suite default).
    expect(en!.classes()).toContain('lang--on')
    expect(pl!.classes()).not.toContain('lang--on')

    await pl!.trigger('click')

    expect(i18n.global.locale.value).toBe('pl')
    expect(pl!.classes()).toContain('lang--on')
    expect(en!.classes()).not.toContain('lang--on')
  })

  it('toggles the theme and reflects it on <html data-theme>', async () => {
    const wrapper = mountApp()
    const toggle = wrapper.get('.theme-toggle')

    // Default preference is light.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(toggle.text()).toContain('☀')

    await toggle.trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(toggle.text()).toContain('☾')
  })

  it('links to the three main sections', () => {
    const wrapper = mountApp()
    expect(wrapper.find('.nav__links').exists()).toBe(true)
    // Translate / Segments / Metrics.
    expect(wrapper.findAll('.nav__links a')).toHaveLength(3)
  })
})
