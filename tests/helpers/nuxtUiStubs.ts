import type { PropType } from 'vue'
import { defineComponent, h } from 'vue'

/**
 * Lightweight test-only stand-ins for the Nuxt UI 4 components this phase
 * introduces (`UButton`, `UIcon`, `USelectMenu`, `UModal`, `UInput`, `UAlert`).
 *
 * The real components (`node_modules/@nuxt/ui/dist/runtime/components/*.vue`)
 * import Nuxt build-time virtual modules (`#build/ui/*`) and `useAppConfig`
 * from `#imports` -- both only exist when compiled through Nuxt's own Vite
 * pipeline. This project's plain `vitest.config.ts` registers only
 * `@vitejs/plugin-vue` (no Nuxt), so mounting the real components under
 * `@vue/test-utils` throws at import time -- there is no in-repo precedent
 * for mounting any Nuxt UI component this way (GameCard.vue/WeekNav.vue's
 * own UButton/UIcon usage is never exercised via `mount()`, only through the
 * live dev server).
 *
 * These stubs reproduce only the prop/slot/event *contract* ScenarioSwitcher.vue
 * and DeleteScenarioModal.vue rely on -- enough to prove those two
 * components' OWN event wiring (emits, `@click.stop`, `:disabled`,
 * `:aria-label`, scoped-slot item passing) is correct. They intentionally do
 * not reproduce Nuxt UI's own internal behavior (theming, focus trap, a11y
 * roles beyond the ones asserted in these tests) -- that is Nuxt UI's own
 * tested responsibility, not this app's.
 */

interface StubItem {
  [key: string]: unknown
}

export const UButtonStub = defineComponent({
  name: 'UButton',
  inheritAttrs: false,
  props: {
    label: { type: String, required: false }
  },
  setup(props, { attrs, slots }) {
    return () => h('button', { type: 'button', ...attrs }, slots.default ? slots.default() : props.label)
  }
})

export const UIconStub = defineComponent({
  name: 'UIcon',
  inheritAttrs: false,
  props: {
    name: { type: String, required: false }
  },
  setup(props, { attrs }) {
    return () => h('span', { 'data-icon': props.name, ...attrs })
  }
})

export const USelectMenuStub = defineComponent({
  name: 'USelectMenu',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<StubItem[]>, default: () => [] },
    modelValue: { type: String, required: false },
    valueKey: { type: String, default: 'value' },
    labelKey: { type: String, default: 'label' }
  },
  emits: ['update:modelValue'],
  setup(props, { slots, emit, attrs }) {
    return () => h('div', { ...attrs }, [
      slots.leading?.(),
      ...props.items.map(item =>
        h('div', {
          key: item[props.valueKey] as string,
          role: 'option',
          onClick: () => emit('update:modelValue', item[props.valueKey])
        }, [
          slots['item-leading']?.({ item }),
          slots['item-label']?.({ item }) ?? String(item[props.labelKey]),
          slots['item-trailing']?.({ item })
        ])
      )
    ])
  }
})

export const UInputStub = defineComponent({
  name: 'UInput',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, required: false },
    readonly: { type: Boolean, default: false }
  },
  setup(props, { attrs }) {
    return () => h('input', { type: 'text', value: props.modelValue, readonly: props.readonly, ...attrs })
  }
})

export const UModalStub = defineComponent({
  name: 'UModal',
  inheritAttrs: false,
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, required: false }
  },
  emits: ['update:open'],
  setup(props, { slots, emit, attrs }) {
    return () => {
      if (!props.open) return null
      const close = () => emit('update:open', false)
      return h('div', { role: 'dialog', ...attrs }, [
        props.title ? h('h2', props.title) : null,
        slots.body?.({ close }),
        slots.footer?.({ close })
      ])
    }
  }
})

export const UAlertStub = defineComponent({
  name: 'UAlert',
  inheritAttrs: false,
  props: {
    title: { type: String, required: false },
    description: { type: String, required: false },
    color: { type: String, required: false },
    icon: { type: String, required: false },
    actions: { type: Array as PropType<StubItem[]>, default: () => [] },
    close: { type: Boolean, default: false }
  },
  emits: ['update:open'],
  setup(props, { emit, attrs }) {
    return () => h('div', { 'role': 'alert', 'data-color': props.color, ...attrs }, [
      props.title ? h('h3', props.title) : null,
      props.description ? h('p', props.description) : null,
      ...props.actions.map(action =>
        h('button', { type: 'button', onClick: action.onClick as () => void }, action.label as string)
      ),
      props.close ? h('button', { 'type': 'button', 'aria-label': 'Close', 'onClick': () => emit('update:open', false) }) : null
    ])
  }
})

/**
 * `UAccordion` stand-in for `StandingsSidebar`. The real component collapses
 * each conference independently and unmounts hidden panels; this stub renders
 * every item's trigger label and `#body` slot at once, because these tests
 * assert on WHICH conferences the sidebar hands to `StandingsTable`, not on
 * accordion open/close mechanics (Nuxt UI's own tested responsibility).
 */
export const UAccordionStub = defineComponent({
  name: 'UAccordion',
  inheritAttrs: false,
  props: {
    items: { type: Array as PropType<StubItem[]>, default: () => [] }
  },
  setup(props, { slots, attrs }) {
    return () => h('div', { ...attrs }, props.items.map(item =>
      h('div', { 'key': item.value as string, 'data-accordion-item': item.value as string }, [
        h('h3', String(item.label)),
        slots.body?.({ item })
      ])
    ))
  }
})

/**
 * `USidebar` stand-in for `StandingsSidebar`. Always renders the default slot
 * in the `'expanded'` state -- the collapsed/icon state is Nuxt UI's own
 * behavior, and every assertion in these tests is about the expanded panel's
 * contents.
 */
export const USidebarStub = defineComponent({
  name: 'USidebar',
  inheritAttrs: false,
  props: {
    open: { type: Boolean, default: true },
    title: { type: String, required: false }
  },
  emits: ['update:open'],
  setup(props, { slots, attrs }) {
    return () => h('aside', { ...attrs }, [
      props.title ? h('h2', props.title) : null,
      slots.default?.({ state: 'expanded' })
    ])
  }
})

export const nuxtUiTestStubs = {
  UAccordion: UAccordionStub,
  USidebar: USidebarStub,
  UButton: UButtonStub,
  UIcon: UIconStub,
  USelectMenu: USelectMenuStub,
  UModal: UModalStub,
  UInput: UInputStub,
  UAlert: UAlertStub
}
