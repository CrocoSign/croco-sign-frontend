import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

import BrandLogo from '@/components/BrandLogo.vue'

describe('BrandLogo', () => {
  it('renders an accessible SVG mark and the wordmark', () => {
    const wrapper = mount(BrandLogo)

    const svg = wrapper.find('svg')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('CrocoSign')

    expect(wrapper.find('.logo__croco').text()).toBe('Croco')
    expect(wrapper.find('.logo__sign').text()).toBe('Sign')
  })
})
