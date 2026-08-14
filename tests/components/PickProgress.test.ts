import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import PickProgress from '~/components/PickProgress.vue'

/**
 * Tests for PickProgress global progress badge component.
 * Displays overall season progress as "{X}/{Y} picked".
 */

// Mock the composable
vi.mock('~/composables/usePickProgress', () => ({
  usePickProgress: vi.fn()
}))

import { usePickProgress } from '~/composables/usePickProgress'

describe('PickProgress Component', () => {
  let mockProgressOverall: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create reactive mock computed for progressOverall
    mockProgressOverall = ref({ picked: 0, total: 0 })

    // Setup mock implementation
    ;(usePickProgress as any).mockReturnValue({
      progressOverall: mockProgressOverall
    })
  })

  it('should render with initial progress', () => {
    mockProgressOverall.value = { picked: 5, total: 100 }

    const wrapper = mount(PickProgress)
    expect(wrapper.text()).toContain('5/100 picked')
  })

  it('should render text-based format without percentage or bar', () => {
    mockProgressOverall.value = { picked: 25, total: 100 }

    const wrapper = mount(PickProgress)
    const text = wrapper.text()

    expect(text).toContain('25/100 picked')
    expect(text).not.toContain('%')
    expect(text).not.toContain('bar')
    expect(text).not.toContain('progress')
  })

  it('should handle zero progress', () => {
    mockProgressOverall.value = { picked: 0, total: 100 }

    const wrapper = mount(PickProgress)
    expect(wrapper.text()).toContain('0/100 picked')
  })

  it('should handle all games picked', () => {
    mockProgressOverall.value = { picked: 100, total: 100 }

    const wrapper = mount(PickProgress)
    expect(wrapper.text()).toContain('100/100 picked')
  })

  it('should render before games load (0/0)', () => {
    mockProgressOverall.value = { picked: 0, total: 0 }

    const wrapper = mount(PickProgress)
    expect(wrapper.text()).toContain('0/0 picked')
  })

  it('should accept season prop and pass to composable', () => {
    const usePickProgressSpy = usePickProgress as any

    mount(PickProgress, {
      props: { season: 2027 }
    })

    expect(usePickProgressSpy).toHaveBeenCalledWith(2027)
  })

  it('should default to season 2026', () => {
    const usePickProgressSpy = usePickProgress as any

    mount(PickProgress)

    expect(usePickProgressSpy).toHaveBeenCalledWith(2026)
  })

  it('should update reactively when progress changes', async () => {
    mockProgressOverall.value = { picked: 5, total: 100 }

    const wrapper = mount(PickProgress)
    expect(wrapper.text()).toContain('5/100 picked')

    // Update progress
    mockProgressOverall.value = { picked: 10, total: 100 }
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('10/100 picked')
  })

  it('should use neutral text color styling', () => {
    mockProgressOverall.value = { picked: 5, total: 100 }

    const wrapper = mount(PickProgress)
    const div = wrapper.find('div')

    // Check for neutral color classes (slate-700 light, slate-300 dark)
    const classes = div.classes()
    expect(classes).toContain('text-sm')
    expect(classes.some(c => c.includes('text-slate') || c.includes('slate-'))).toBe(true)
  })

  it('should render as plain text, not a badge component', () => {
    mockProgressOverall.value = { picked: 5, total: 100 }

    const wrapper = mount(PickProgress)
    const html = wrapper.html()

    // Should not contain UBadge or badge-related HTML
    expect(html).not.toContain('badge')
    expect(html).not.toContain('UBadge')
  })
})
