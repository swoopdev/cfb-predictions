import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import ScenarioSwitcher from '~/components/ScenarioSwitcher.vue'
import type { ScenarioMeta } from '#shared/types/scenarios'
import { nuxtUiTestStubs } from '../helpers/nuxtUiStubs'

/**
 * ScenarioSwitcher event-contract tests (SCEN-02/03/04, D-08, D-10, D-14).
 *
 * Mounted with the Nuxt UI test stubs (`tests/helpers/nuxtUiStubs.ts`) --
 * see that file's docblock for why the real `USelectMenu`/`UButton`/`UIcon`
 * cannot be mounted directly under this project's plain (non-Nuxt) vitest
 * project. The stubs reproduce only the prop/slot/event contract this
 * component depends on, so what these tests actually prove is
 * ScenarioSwitcher's OWN wiring -- not Nuxt UI's internal behavior.
 *
 * This component takes everything as props/emits -- no composable to mock.
 */

function scenarioList(): ScenarioMeta[] {
  return [
    { id: 'a', name: 'Scenario A', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'b', name: 'Scenario B', createdAt: '2026-01-01T00:00:00.000Z' }
  ]
}

function mountSwitcher(props: { scenarios?: ScenarioMeta[], modelValue?: string } = {}) {
  return mount(ScenarioSwitcher, {
    props: {
      scenarios: props.scenarios ?? scenarioList(),
      modelValue: props.modelValue ?? 'a'
    },
    global: { stubs: nuxtUiTestStubs }
  })
}

describe('ScenarioSwitcher', () => {
  // Nuxt UI renders its own selected-state check via ComboboxItemIndicator,
  // after the #item-trailing slot and outside any slot this component can
  // override -- so it lands at the far END of the row, past the
  // edit/duplicate/share/delete buttons. The selected marker belongs at the
  // front (see the #item-leading check below), so the built-in one is hidden.
  it('hides the built-in trailing check so the only selected marker is the leading one', () => {
    const wrapper = mountSwitcher()

    const menu = wrapper.findComponent({ name: 'USelectMenu' })
    expect(menu.props('ui').itemTrailingIcon).toBe('hidden')
  })

  it('renders every scenario in the scenarios prop', async () => {
    const wrapper = mountSwitcher()

    expect(wrapper.text()).toContain('Scenario A')
    expect(wrapper.text()).toContain('Scenario B')
  })

  it('emits update:modelValue with the selected scenario id when a row is chosen', async () => {
    const wrapper = mountSwitcher()

    const rows = wrapper.findAll('[role="option"]')
    expect(rows).toHaveLength(2)
    await rows[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })

  // The rename input lives INSIDE a combobox listbox, which treats Space as
  // "select the highlighted option" -- so typing a space in a scenario name
  // used to close the menu and commit the half-typed name. The input stops
  // the event from reaching that handler while still letting the space be
  // typed, which is what this asserts: the keydown must not propagate.
  it('rename: Space is typed into the name, not swallowed as a menu selection', async () => {
    const wrapper = mountSwitcher()
    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')

    const bubbled: string[] = []
    wrapper.element.addEventListener('keydown', e => bubbled.push((e as KeyboardEvent).key))

    const input = wrapper.get('input')
    await input.trigger('keydown', { key: ' ' })

    expect(bubbled).not.toContain(' ')
    // Still editing, nothing committed.
    expect(wrapper.emitted('rename')).toBeUndefined()
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('rename: focuses and selects the name so typing replaces it immediately', async () => {
    const wrapper = mount(ScenarioSwitcher, {
      attachTo: document.body,
      props: { scenarios: scenarioList(), modelValue: 'a' },
      global: { stubs: nuxtUiTestStubs }
    })

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    await nextTick()

    const input = wrapper.get('input').element as HTMLInputElement
    expect(document.activeElement).toBe(input)
    expect(input.selectionStart).toBe(0)
    expect(input.selectionEnd).toBe('Scenario A'.length)

    wrapper.unmount()
  })

  it('rename: pencil click enters inline edit state; Enter commits rename and does not emit update:modelValue', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')

    const input = wrapper.get('input')
    expect(input.exists()).toBe(true)

    await input.setValue('Renamed A')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('rename')?.[0]).toEqual(['a', 'Renamed A'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('rename: blurring the input also commits, without needing Enter', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    const input = wrapper.get('input')
    await input.setValue('Blurred Name')
    await input.trigger('blur')

    expect(wrapper.emitted('rename')?.[0]).toEqual(['a', 'Blurred Name'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('rename: Escape cancels without emitting rename', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    const input = wrapper.get('input')
    await input.setValue('Should Not Save')
    await input.trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('rename')).toBeUndefined()
    expect(wrapper.find('input').exists()).toBe(false)
  })

  // WR-01: an empty/whitespace-only commit is dropped -- no emit at all.
  it('rename: committing an empty or whitespace-only name does not emit rename', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    const input = wrapper.get('input')
    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('rename')).toBeUndefined()
    expect(wrapper.find('input').exists()).toBe(false)
  })

  // WR-01: leading/trailing whitespace is trimmed before emitting.
  it('rename: trims surrounding whitespace before emitting rename', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    const input = wrapper.get('input')
    await input.setValue('  Trimmed  ')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('rename')?.[0]).toEqual(['a', 'Trimmed'])
  })

  // WR-02: a `pendingEditId` matching a real row auto-enters edit state,
  // exactly like a manual pencil-icon click would.
  it('pendingEditId: auto-enters inline edit state for the matching row', async () => {
    const wrapper = mountSwitcher()

    await wrapper.setProps({ pendingEditId: 'b' })

    const input = wrapper.get('input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('Scenario B')
  })

  // WR-02: an unknown pendingEditId (e.g. stale/mismatched) is a no-op.
  it('pendingEditId: does nothing when it does not match any scenario', async () => {
    const wrapper = mountSwitcher()

    await wrapper.setProps({ pendingEditId: 'does-not-exist' })

    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('duplicate: copy icon emits duplicate(id) and does not emit update:modelValue', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="Duplicate Scenario A"]').trigger('click')

    expect(wrapper.emitted('duplicate')?.[0]).toEqual(['a'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('share: share icon emits share(id) and does not emit update:modelValue', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="Share Scenario A"]').trigger('click')

    expect(wrapper.emitted('share')?.[0]).toEqual(['a'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('share affordance carries no disabled binding regardless of scenario count', async () => {
    const wrapper = mountSwitcher({
      scenarios: [{ id: 'a', name: 'Scenario A', createdAt: '2026-01-01T00:00:00.000Z' }],
      modelValue: 'a'
    })

    const share = wrapper.get('[aria-label="Share Scenario A"]')
    expect(share.attributes('disabled')).toBeUndefined()
  })

  it('delete: trash icon emits delete(id) and does not emit update:modelValue', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="Delete Scenario A"]').trigger('click')

    expect(wrapper.emitted('delete')?.[0]).toEqual(['a'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('delete affordance is disabled with a discoverable reason when exactly one scenario remains (D-14)', async () => {
    const wrapper = mountSwitcher({
      scenarios: [{ id: 'a', name: 'Scenario A', createdAt: '2026-01-01T00:00:00.000Z' }],
      modelValue: 'a'
    })

    const trash = wrapper.get('[aria-label="Delete Scenario A"]')
    expect(trash.attributes('disabled')).toBeDefined()
    expect(trash.attributes('title')).toBe('At least one scenario is required')
  })

  it('delete affordance is enabled with no title when 2+ scenarios exist', async () => {
    const wrapper = mountSwitcher()

    const trash = wrapper.get('[aria-label="Delete Scenario A"]')
    expect(trash.attributes('disabled')).toBeUndefined()
    expect(trash.attributes('title')).toBeUndefined()
  })

  // The add affordance is icon-only now: the enclosing "Scenarios" segment
  // already supplies the noun, so a "+ New Scenario" label rendered next to
  // the plus glyph read as "+ + New Scenario". The name still reaches
  // assistive tech through aria-label, which is what this asserts against.
  it('clicking the add button emits create with no payload', async () => {
    const wrapper = mountSwitcher()

    await wrapper.get('[aria-label="New Scenario"]').trigger('click')

    expect(wrapper.emitted('create')?.[0]).toEqual([])
  })

  it('every icon-only row button carries the exact aria-label from the Copywriting Contract, interpolating the scenario name', async () => {
    const wrapper = mountSwitcher()

    expect(wrapper.find('[aria-label="Rename Scenario A"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Duplicate Scenario A"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Share Scenario A"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Delete Scenario A"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Rename Scenario B"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Duplicate Scenario B"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Share Scenario B"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="Delete Scenario B"]').exists()).toBe(true)
  })
})
