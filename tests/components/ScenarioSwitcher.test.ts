import { describe, it, expect } from 'vitest'
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

function mountCollapsed(props: { scenarios?: ScenarioMeta[], modelValue?: string } = {}) {
  return mount(ScenarioSwitcher, {
    props: {
      scenarios: props.scenarios ?? scenarioList(),
      modelValue: props.modelValue ?? 'a'
    },
    global: { stubs: nuxtUiTestStubs }
  })
}

/**
 * The switcher is a collapsible segment that starts CLOSED -- picking games
 * is the page's job and managing scenarios is an occasional detour, so the
 * segment costs one summary line until the user opens it. The select menu
 * and every row action therefore only exist once it is expanded, which is
 * what this helper does before handing the wrapper back.
 */
async function mountSwitcher(props: { scenarios?: ScenarioMeta[], modelValue?: string } = {}) {
  const wrapper = mountCollapsed(props)
  await wrapper.get('button[aria-expanded]').trigger('click')
  return wrapper
}

describe('ScenarioSwitcher', () => {
  it('starts collapsed, naming the active scenario without exposing the row actions', () => {
    const wrapper = mountCollapsed({ modelValue: 'b' })

    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('false')
    expect(wrapper.text()).toContain('Scenarios')
    // The active scenario is readable while collapsed, so the user never has
    // to expand the segment just to confirm which picks are on screen.
    expect(wrapper.text()).toContain('Scenario B')
    expect(wrapper.find('[aria-label="Rename Scenario B"]').exists()).toBe(false)
  })

  it('expands on click, revealing the select menu and row actions', async () => {
    const wrapper = mountCollapsed()

    await wrapper.get('button[aria-expanded]').trigger('click')

    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('[aria-label="Rename Scenario A"]').exists()).toBe(true)
  })

  it('force-expands so a pending inline rename is never set on a hidden row', async () => {
    const wrapper = mountCollapsed()
    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('false')

    await wrapper.setProps({ pendingEditId: 'b' })

    expect(wrapper.get('button[aria-expanded]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.find('input').exists()).toBe(true)
  })

  it('renders every scenario in the scenarios prop', async () => {
    const wrapper = await mountSwitcher()

    expect(wrapper.text()).toContain('Scenario A')
    expect(wrapper.text()).toContain('Scenario B')
  })

  it('emits update:modelValue with the selected scenario id when a row is chosen', async () => {
    const wrapper = await mountSwitcher()

    const rows = wrapper.findAll('[role="option"]')
    expect(rows).toHaveLength(2)
    await rows[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })

  it('rename: pencil click enters inline edit state; Enter commits rename and does not emit update:modelValue', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')

    const input = wrapper.get('input')
    expect(input.exists()).toBe(true)

    await input.setValue('Renamed A')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('rename')?.[0]).toEqual(['a', 'Renamed A'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('rename: blurring the input also commits, without needing Enter', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    const input = wrapper.get('input')
    await input.setValue('Blurred Name')
    await input.trigger('blur')

    expect(wrapper.emitted('rename')?.[0]).toEqual(['a', 'Blurred Name'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('rename: Escape cancels without emitting rename', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    const input = wrapper.get('input')
    await input.setValue('Should Not Save')
    await input.trigger('keydown', { key: 'Escape' })

    expect(wrapper.emitted('rename')).toBeUndefined()
    expect(wrapper.find('input').exists()).toBe(false)
  })

  // WR-01: an empty/whitespace-only commit is dropped -- no emit at all.
  it('rename: committing an empty or whitespace-only name does not emit rename', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    const input = wrapper.get('input')
    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('rename')).toBeUndefined()
    expect(wrapper.find('input').exists()).toBe(false)
  })

  // WR-01: leading/trailing whitespace is trimmed before emitting.
  it('rename: trims surrounding whitespace before emitting rename', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="Rename Scenario A"]').trigger('click')
    const input = wrapper.get('input')
    await input.setValue('  Trimmed  ')
    await input.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('rename')?.[0]).toEqual(['a', 'Trimmed'])
  })

  // WR-02: a `pendingEditId` matching a real row auto-enters edit state,
  // exactly like a manual pencil-icon click would.
  it('pendingEditId: auto-enters inline edit state for the matching row', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.setProps({ pendingEditId: 'b' })

    const input = wrapper.get('input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('Scenario B')
  })

  // WR-02: an unknown pendingEditId (e.g. stale/mismatched) is a no-op.
  it('pendingEditId: does nothing when it does not match any scenario', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.setProps({ pendingEditId: 'does-not-exist' })

    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('duplicate: copy icon emits duplicate(id) and does not emit update:modelValue', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="Duplicate Scenario A"]').trigger('click')

    expect(wrapper.emitted('duplicate')?.[0]).toEqual(['a'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('share: share icon emits share(id) and does not emit update:modelValue', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="Share Scenario A"]').trigger('click')

    expect(wrapper.emitted('share')?.[0]).toEqual(['a'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('share affordance carries no disabled binding regardless of scenario count', async () => {
    const wrapper = await mountSwitcher({
      scenarios: [{ id: 'a', name: 'Scenario A', createdAt: '2026-01-01T00:00:00.000Z' }],
      modelValue: 'a'
    })

    const share = wrapper.get('[aria-label="Share Scenario A"]')
    expect(share.attributes('disabled')).toBeUndefined()
  })

  it('delete: trash icon emits delete(id) and does not emit update:modelValue', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="Delete Scenario A"]').trigger('click')

    expect(wrapper.emitted('delete')?.[0]).toEqual(['a'])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('delete affordance is disabled with a discoverable reason when exactly one scenario remains (D-14)', async () => {
    const wrapper = await mountSwitcher({
      scenarios: [{ id: 'a', name: 'Scenario A', createdAt: '2026-01-01T00:00:00.000Z' }],
      modelValue: 'a'
    })

    const trash = wrapper.get('[aria-label="Delete Scenario A"]')
    expect(trash.attributes('disabled')).toBeDefined()
    expect(trash.attributes('title')).toBe('At least one scenario is required')
  })

  it('delete affordance is enabled with no title when 2+ scenarios exist', async () => {
    const wrapper = await mountSwitcher()

    const trash = wrapper.get('[aria-label="Delete Scenario A"]')
    expect(trash.attributes('disabled')).toBeUndefined()
    expect(trash.attributes('title')).toBeUndefined()
  })

  // The add affordance is icon-only now: the enclosing "Scenarios" segment
  // already supplies the noun, so a "+ New Scenario" label rendered next to
  // the plus glyph read as "+ + New Scenario". The name still reaches
  // assistive tech through aria-label, which is what this asserts against.
  it('clicking the add button emits create with no payload', async () => {
    const wrapper = await mountSwitcher()

    await wrapper.get('[aria-label="New Scenario"]').trigger('click')

    expect(wrapper.emitted('create')?.[0]).toEqual([])
  })

  it('every icon-only row button carries the exact aria-label from the Copywriting Contract, interpolating the scenario name', async () => {
    const wrapper = await mountSwitcher()

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
