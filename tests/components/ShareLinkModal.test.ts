import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShareLinkModal from '~/components/ShareLinkModal.vue'
import { nuxtUiTestStubs } from '../helpers/nuxtUiStubs'

/**
 * ShareLinkModal event-contract tests (SHARE-01, D-02, D-13).
 *
 * Mounted with the Nuxt UI test stubs (`tests/helpers/nuxtUiStubs.ts`) --
 * see that file's docblock for why the real `UModal`/`UInput`/`UButton`
 * cannot be mounted directly under this project's plain (non-Nuxt) vitest
 * project.
 */

function mountModal(props: { open?: boolean, scenarioName?: string, shareUrl?: string } = {}) {
  return mount(ShareLinkModal, {
    props: {
      open: props.open ?? true,
      scenarioName: props.scenarioName ?? 'My Scenario',
      shareUrl: props.shareUrl ?? 'https://example.test/week/1#s=abc123'
    },
    global: { stubs: nuxtUiTestStubs }
  })
}

describe('ShareLinkModal', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the exact title and body copy from the Copywriting Contract', () => {
    const wrapper = mountModal({ scenarioName: 'My Scenario' })

    expect(wrapper.get('h2').text()).toBe('Share "My Scenario"')
    expect(wrapper.text()).toContain('Anyone with this link can view these picks.')
  })

  it('renders the share URL input with the exact shareUrl prop value and a readonly attribute', () => {
    const wrapper = mountModal({ shareUrl: 'https://example.test/week/1#s=abc123' })

    const input = wrapper.get('input')
    expect((input.element as HTMLInputElement).value).toBe('https://example.test/week/1#s=abc123')
    expect(input.attributes('readonly')).toBeDefined()
  })

  it('clicking "Copy Link" calls navigator.clipboard.writeText with the exact shareUrl prop value', async () => {
    const wrapper = mountModal({ shareUrl: 'https://example.test/week/1#s=abc123' })

    const copyButton = wrapper.findAll('button').find(b => b.text().includes('Copy Link'))
    expect(copyButton).toBeDefined()
    await copyButton!.trigger('click')

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.test/week/1#s=abc123')
  })

  it('after a successful copy, the button swaps to "Copied!" then reverts to "Copy Link" after ~2000ms', async () => {
    vi.useFakeTimers()
    const wrapper = mountModal()

    const copyButton = wrapper.findAll('button').find(b => b.text().includes('Copy Link'))!
    await copyButton.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Copied!')
    expect(wrapper.text()).not.toContain('Copy Link')

    vi.advanceTimersByTime(2000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Copy Link')
    expect(wrapper.text()).not.toContain('Copied!')
  })

  it('when navigator.clipboard is undefined, clicking "Copy Link" does not throw and does not enter the "Copied!" state', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const wrapper = mountModal()

    const copyButton = wrapper.findAll('button').find(b => b.text().includes('Copy Link'))!
    await expect(copyButton.trigger('click')).resolves.not.toThrow()

    expect(wrapper.text()).toContain('Copy Link')
    expect(wrapper.text()).not.toContain('Copied!')
  })

  it('focusing the URL input selects its full text', async () => {
    const wrapper = mountModal()

    const input = wrapper.get('input')
    const selectSpy = vi.fn()
    ;(input.element as HTMLInputElement).select = selectSpy

    await input.trigger('focus')

    expect(selectSpy).toHaveBeenCalled()
  })

  it('renders nothing when open is false', () => {
    const wrapper = mountModal({ open: false })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('emits update:open(false) when the underlying UModal fires update:open', async () => {
    const wrapper = mountModal()

    const modal = wrapper.findComponent({ name: 'UModal' })
    await modal.vm.$emit('update:open', false)

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })
})
