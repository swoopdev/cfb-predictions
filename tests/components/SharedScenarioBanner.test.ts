import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SharedScenarioBanner from '~/components/SharedScenarioBanner.vue'
import { nuxtUiTestStubs } from '../helpers/nuxtUiStubs'

/**
 * SharedScenarioBanner copy/color/action-contract tests (SHARE-02/03/04,
 * D-05/D-08/D-11, 08-UI-SPEC.md's Copywriting Contract).
 *
 * Mounted with the Nuxt UI test stubs -- see `tests/helpers/nuxtUiStubs.ts`'s
 * docblock for why the real `UAlert` cannot be mounted directly under this
 * project's plain (non-Nuxt) vitest project.
 */

function mountBanner(props: { variant: 'default' | 'mismatch' | 'malformed', appliedCount?: number, totalCount?: number }) {
  return mount(SharedScenarioBanner, {
    props,
    global: { stubs: nuxtUiTestStubs }
  })
}

describe('SharedScenarioBanner', () => {
  it('renders the "default" variant\'s exact copy, info color, and a Save a copy action', async () => {
    const wrapper = mountBanner({ variant: 'default' })

    expect(wrapper.get('h3').text()).toBe('You\'re viewing a shared scenario')
    expect(wrapper.get('p').text()).toBe('These picks aren\'t saved to your device yet.')
    expect(wrapper.get('[role="alert"]').attributes('data-color')).toBe('info')

    const buttons = wrapper.findAll('button')
    const saveButtons = buttons.filter(b => b.text() === 'Save a copy')
    expect(saveButtons).toHaveLength(1)

    await saveButtons[0]!.trigger('click')
    expect(wrapper.emitted('save-copy')).toHaveLength(1)
  })

  it('renders the "mismatch" variant\'s exact N-of-M title, warning color, and a Save a copy action', async () => {
    const wrapper = mountBanner({ variant: 'mismatch', appliedCount: 3, totalCount: 6 })

    expect(wrapper.get('h3').text()).toBe('3 of 6 picks applied')
    expect(wrapper.get('p').text()).toBe('This link was created for a different schedule version.')
    expect(wrapper.get('[role="alert"]').attributes('data-color')).toBe('warning')

    const buttons = wrapper.findAll('button')
    const saveButtons = buttons.filter(b => b.text() === 'Save a copy')
    expect(saveButtons).toHaveLength(1)

    await saveButtons[0]!.trigger('click')
    expect(wrapper.emitted('save-copy')).toHaveLength(1)
  })

  it('renders the "malformed" variant\'s exact copy, error color, and ZERO action buttons', () => {
    const wrapper = mountBanner({ variant: 'malformed' })

    expect(wrapper.get('h3').text()).toBe('This link couldn\'t be read')
    expect(wrapper.get('p').text()).toBe('The share link is invalid or corrupted. Your own picks are unaffected.')
    expect(wrapper.get('[role="alert"]').attributes('data-color')).toBe('error')

    const buttons = wrapper.findAll('button')
    const saveButtons = buttons.filter(b => b.text() === 'Save a copy')
    expect(saveButtons).toHaveLength(0)
  })

  it.each(['default', 'mismatch', 'malformed'] as const)('%s variant emits dismiss when the alert\'s dismiss control fires', async (variant) => {
    const wrapper = mountBanner({ variant, appliedCount: 1, totalCount: 2 })

    const alert = wrapper.findComponent({ name: 'UAlert' })
    await alert.vm.$emit('update:open', false)

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })
})
