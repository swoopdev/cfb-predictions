/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import PickProgressWeek from '~/components/PickProgressWeek.vue'

import { usePickProgress } from '~/composables/usePickProgress'

/**
 * Tests for PickProgressWeek per-week progress badge component.
 * Displays week-specific progress as "{X}/{Y} picked".
 */

// Mock the composable
vi.mock('~/composables/usePickProgress', () => ({
  usePickProgress: vi.fn()
}))

describe('PickProgressWeek Component', () => {
  let mockProgressForWeek: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Create mock function that returns computed values
    mockProgressForWeek = vi.fn((_weekNum: number) =>
      ref({ picked: 0, total: 0 })
    )

    // Setup mock implementation
    ;(usePickProgress as any).mockReturnValue({
      progressForWeek: mockProgressForWeek
    })
  })

  it('should render with initial week progress', () => {
    mockProgressForWeek.mockReturnValue(ref({ picked: 3, total: 14 }))

    const wrapper = mount(PickProgressWeek, {
      props: { weekNum: 1 }
    })

    expect(wrapper.text()).toContain('3/14 picked')
  })

  it('should render text-based format without percentage or bar', () => {
    mockProgressForWeek.mockReturnValue(ref({ picked: 7, total: 14 }))

    const wrapper = mount(PickProgressWeek, {
      props: { weekNum: 2 }
    })

    const text = wrapper.text()
    expect(text).toContain('7/14 picked')
    expect(text).not.toContain('%')
  })

  it('should accept weekNum prop and call progressForWeek with it', () => {
    mockProgressForWeek.mockReturnValue(ref({ picked: 2, total: 10 }))

    mount(PickProgressWeek, {
      props: { weekNum: 5 }
    })

    expect(mockProgressForWeek).toHaveBeenCalledWith(5)
  })

  it('should accept season prop and pass to composable', () => {
    const usePickProgressSpy = usePickProgress as any
    mockProgressForWeek.mockReturnValue(ref({ picked: 0, total: 0 }))

    mount(PickProgressWeek, {
      props: { weekNum: 1, season: 2027 }
    })

    expect(usePickProgressSpy).toHaveBeenCalledWith(2027)
  })

  it('should default to season 2026', () => {
    const usePickProgressSpy = usePickProgress as any
    mockProgressForWeek.mockReturnValue(ref({ picked: 0, total: 0 }))

    mount(PickProgressWeek, {
      props: { weekNum: 1 }
    })

    expect(usePickProgressSpy).toHaveBeenCalledWith(2026)
  })

  it('should handle zero progress for a week', () => {
    mockProgressForWeek.mockReturnValue(ref({ picked: 0, total: 14 }))

    const wrapper = mount(PickProgressWeek, {
      props: { weekNum: 3 }
    })

    expect(wrapper.text()).toContain('0/14 picked')
  })

  it('should handle all games picked in a week', () => {
    mockProgressForWeek.mockReturnValue(ref({ picked: 14, total: 14 }))

    const wrapper = mount(PickProgressWeek, {
      props: { weekNum: 4 }
    })

    expect(wrapper.text()).toContain('14/14 picked')
  })

  it('should handle week with no games (0/0)', () => {
    mockProgressForWeek.mockReturnValue(ref({ picked: 0, total: 0 }))

    const wrapper = mount(PickProgressWeek, {
      props: { weekNum: 15 } // Assuming week 15 has no games
    })

    expect(wrapper.text()).toContain('0/0 picked')
  })

  it('should update reactively when week progress changes', async () => {
    const mockProgress = ref({ picked: 3, total: 14 })
    mockProgressForWeek.mockReturnValue(mockProgress)

    const wrapper = mount(PickProgressWeek, {
      props: { weekNum: 1 }
    })

    expect(wrapper.text()).toContain('3/14 picked')

    // Update progress
    mockProgress.value = { picked: 8, total: 14 }
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('8/14 picked')
  })

  it('should render a progress bar track, proportional fill, and centered label', () => {
    mockProgressForWeek.mockReturnValue(ref({ picked: 5, total: 10 }))

    const wrapper = mount(PickProgressWeek, {
      props: { weekNum: 1 }
    })

    // Track: muted background, clipping the fill. The week bar is deliberately
    // shorter than the season bar (20px vs 24px) and must not be squeezed by
    // the flex row it sits in.
    const track = wrapper.find('div')
    const trackClasses = track.classes()
    expect(trackClasses).toContain('bg-muted')
    expect(trackClasses).toContain('h-5')
    expect(trackClasses).toContain('overflow-hidden')
    expect(trackClasses).toContain('shrink-0')

    // Fill: primary colour, width driven by picked/total, animated on change.
    const fill = wrapper.find('.bg-primary')
    expect(fill.exists()).toBe(true)
    expect(fill.attributes('style')).toContain('width: 50%')
    expect(fill.classes()).toContain('transition-all')

    // Label: white text centered over the fill, not the pre-polish slate text.
    const label = wrapper.find('span')
    const labelClasses = label.classes()
    expect(labelClasses).toContain('text-xs')
    expect(labelClasses).toContain('text-white')
    expect(label.text()).toBe('5/10 picked')
  })

  it('should display correctly for different weeks', () => {
    mockProgressForWeek.mockImplementation((weekNum: number) => {
      const progressByWeek: Record<number, any> = {
        1: { picked: 5, total: 12 },
        2: { picked: 3, total: 14 },
        3: { picked: 0, total: 13 }
      }
      return ref(progressByWeek[weekNum] || { picked: 0, total: 0 })
    })

    const wrapper1 = mount(PickProgressWeek, { props: { weekNum: 1 } })
    const wrapper2 = mount(PickProgressWeek, { props: { weekNum: 2 } })
    const wrapper3 = mount(PickProgressWeek, { props: { weekNum: 3 } })

    expect(wrapper1.text()).toContain('5/12 picked')
    expect(wrapper2.text()).toContain('3/14 picked')
    expect(wrapper3.text()).toContain('0/13 picked')
  })
})
