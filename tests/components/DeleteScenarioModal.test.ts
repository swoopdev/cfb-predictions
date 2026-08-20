import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DeleteScenarioModal from '~/components/DeleteScenarioModal.vue'
import { nuxtUiTestStubs } from '../helpers/nuxtUiStubs'

/**
 * DeleteScenarioModal event-contract tests (SCEN-03, D-12).
 *
 * Mounted with the Nuxt UI test stubs (`tests/helpers/nuxtUiStubs.ts`) --
 * see that file's docblock for why the real `UModal`/`UButton` cannot be
 * mounted directly under this project's plain (non-Nuxt) vitest project.
 */

function mountModal(props: { open?: boolean, scenarioName?: string } = {}) {
  return mount(DeleteScenarioModal, {
    props: {
      open: props.open ?? true,
      scenarioName: props.scenarioName ?? 'My Scenario'
    },
    global: { stubs: nuxtUiTestStubs }
  })
}

describe('DeleteScenarioModal', () => {
  it('renders the exact title and body copy from the Copywriting Contract', () => {
    const wrapper = mountModal({ scenarioName: 'My Scenario' })

    expect(wrapper.get('h2').text()).toBe('Delete "My Scenario"?')
    expect(wrapper.text()).toContain(
      'This permanently removes its picks, auto-fill history, and tiebreaker decisions. This can\'t be undone.'
    )
  })

  it('interpolates the scenario name inside literal double quotes for any name', () => {
    const wrapper = mountModal({ scenarioName: 'Week 12 What-If' })

    expect(wrapper.get('h2').text()).toBe('Delete "Week 12 What-If"?')
  })

  it('renders nothing when open is false', () => {
    const wrapper = mountModal({ open: false })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('clicking Cancel emits update:open(false) and never emits confirm', async () => {
    const wrapper = mountModal()

    const cancelButton = wrapper.findAll('button').find(b => b.text() === 'Cancel')
    expect(cancelButton).toBeDefined()
    await cancelButton!.trigger('click')

    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('clicking "Delete scenario" emits both confirm and update:open(false)', async () => {
    const wrapper = mountModal()

    const deleteButton = wrapper.findAll('button').find(b => b.text() === 'Delete scenario')
    expect(deleteButton).toBeDefined()
    await deleteButton!.trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('confirm')?.[0]).toEqual([])
    expect(wrapper.emitted('update:open')?.[0]).toEqual([false])
  })

  it('never emits confirm from mounting, unmounting, or toggling open alone', async () => {
    const wrapper = mountModal({ open: true })
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    wrapper.unmount()

    expect(wrapper.emitted('confirm')).toBeUndefined()
  })
})
