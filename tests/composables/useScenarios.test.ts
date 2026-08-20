import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { useScenarios } from '~/composables/useScenarios'
import { scenarioKeys } from '~/utils/scenarioKeys'

const SEASON = 2026
const REGISTRY_KEY = scenarioKeys.registry(SEASON)
const ACTIVE_KEY = scenarioKeys.active(SEASON)

describe('useScenarios', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('fresh install (no registry, no legacy data)', () => {
    it('resolves to a registry with exactly one scenario and a matching activeScenarioId', () => {
      const { scenarios, activeScenarioId } = useScenarios(SEASON)

      expect(scenarios.value).toHaveLength(1)
      expect(activeScenarioId.value).toBe(scenarios.value[0]!.id)
    })
  })

  describe('corrupted/malformed registry recovery', () => {
    it('resets to one fresh scenario when the stored value is not valid JSON, with no secondary corrupt key and no console output', () => {
      localStorage.setItem(REGISTRY_KEY, 'not json{{{')
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { scenarios } = useScenarios(SEASON)

      expect(scenarios.value).toHaveLength(1)
      expect(localStorage.getItem(`${REGISTRY_KEY}_corrupt`)).toBeNull()
      expect(warnSpy).not.toHaveBeenCalled()
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('drops a structurally invalid entry (non-string id) while keeping valid siblings', () => {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify([
        { id: 'a', name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 123, name: 'Bad', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'c', name: 'Charlie', createdAt: '2026-01-01T00:00:00.000Z' }
      ]))

      const { scenarios } = useScenarios(SEASON)

      expect(scenarios.value.map(s => s.id)).toEqual(['a', 'c'])
    })

    it('drops an entry missing name or createdAt while keeping valid siblings', () => {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify([
        { id: 'a', name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'b', createdAt: '2026-01-01T00:00:00.000Z' }, // missing name
        { id: 'c', name: 'Charlie' } // missing createdAt
      ]))

      const { scenarios } = useScenarios(SEASON)

      expect(scenarios.value.map(s => s.id)).toEqual(['a'])
    })

    it('de-duplicates entries sharing the same id, keeping only the first occurrence', () => {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify([
        { id: 'dup', name: 'First', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'dup', name: 'Second', createdAt: '2026-01-02T00:00:00.000Z' }
      ]))

      const { scenarios } = useScenarios(SEASON)

      expect(scenarios.value).toHaveLength(1)
      expect(scenarios.value[0]!.name).toBe('First')
    })

    it('auto-creates one fresh scenario when the stored value is a syntactically valid but empty array', () => {
      localStorage.setItem(REGISTRY_KEY, '[]')

      const { scenarios } = useScenarios(SEASON)

      expect(scenarios.value).toHaveLength(1)
    })
  })

  describe('dangling active-scenario pointer', () => {
    it('corrects activeScenarioId to the registry\'s first entry when it references a nonexistent id', () => {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify([
        { id: 'a', name: 'Alpha', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'b', name: 'Bravo', createdAt: '2026-01-01T00:00:00.000Z' }
      ]))
      localStorage.setItem(ACTIVE_KEY, JSON.stringify('nonexistent-id'))

      const { activeScenarioId } = useScenarios(SEASON)

      expect(activeScenarioId.value).toBe('a')
    })
  })

  describe('migration (D-03)', () => {
    it('wraps all three present legacy keys into one scenario named "My Scenario", copying raw values verbatim and leaving legacy keys untouched', () => {
      localStorage.setItem(scenarioKeys.legacyPicks(SEASON), JSON.stringify({ 1: 100 }))
      localStorage.setItem(scenarioKeys.legacyAutofilled(SEASON), JSON.stringify([1, 2]))
      localStorage.setItem(scenarioKeys.legacyManualTiebreakers(SEASON), JSON.stringify({ SEC: { hash1: [1, 2, 3] } }))

      const { scenarios, activeScenarioId } = useScenarios(SEASON)

      expect(scenarios.value).toHaveLength(1)
      expect(scenarios.value[0]!.name).toBe('My Scenario')
      expect(activeScenarioId.value).toBe(scenarios.value[0]!.id)

      const newId = scenarios.value[0]!.id
      expect(localStorage.getItem(scenarioKeys.picks(SEASON, newId))).toBe(JSON.stringify({ 1: 100 }))
      expect(localStorage.getItem(scenarioKeys.autofilled(SEASON, newId))).toBe(JSON.stringify([1, 2]))
      expect(localStorage.getItem(scenarioKeys.manualTiebreakers(SEASON, newId))).toBe(JSON.stringify({ SEC: { hash1: [1, 2, 3] } }))

      // legacy keys left present and unmodified
      expect(localStorage.getItem(scenarioKeys.legacyPicks(SEASON))).toBe(JSON.stringify({ 1: 100 }))
      expect(localStorage.getItem(scenarioKeys.legacyAutofilled(SEASON))).toBe(JSON.stringify([1, 2]))
      expect(localStorage.getItem(scenarioKeys.legacyManualTiebreakers(SEASON))).toBe(JSON.stringify({ SEC: { hash1: [1, 2, 3] } }))
    })

    it('migrates successfully when only cfb_picks is present, with no phantom writes for the absent autofilled/manual-tiebreakers legacy keys', () => {
      localStorage.setItem(scenarioKeys.legacyPicks(SEASON), JSON.stringify({ 1: 100 }))

      const { scenarios } = useScenarios(SEASON)
      const newId = scenarios.value[0]!.id

      expect(localStorage.getItem(scenarioKeys.picks(SEASON, newId))).toBe(JSON.stringify({ 1: 100 }))
      expect(localStorage.getItem(scenarioKeys.autofilled(SEASON, newId))).toBeNull()
      expect(localStorage.getItem(scenarioKeys.manualTiebreakers(SEASON, newId))).toBeNull()
    })

    it('does not re-run migration or create a second "My Scenario" on a second call after migration already ran once', async () => {
      localStorage.setItem(scenarioKeys.legacyPicks(SEASON), JSON.stringify({ 1: 100 }))

      const first = useScenarios(SEASON)
      expect(first.scenarios.value).toHaveLength(1)
      const firstId = first.scenarios.value[0]!.id
      await nextTick() // flush the registry write to localStorage before the "reload"

      // Simulate a page reload: legacy picks value changes, but migration must not re-fire.
      localStorage.setItem(scenarioKeys.legacyPicks(SEASON), JSON.stringify({ 1: 999 }))

      const second = useScenarios(SEASON)

      expect(second.scenarios.value).toHaveLength(1)
      expect(second.scenarios.value[0]!.id).toBe(firstId)
      expect(second.scenarios.value.filter(s => s.name === 'My Scenario')).toHaveLength(1)
      // the already-migrated scenario's copy was never re-copied from the mutated legacy value
      expect(localStorage.getItem(scenarioKeys.picks(SEASON, firstId))).toBe(JSON.stringify({ 1: 100 }))
    })

    it('creates a scenario named "Scenario 1" (not "My Scenario") when no legacy data exists at all', () => {
      const { scenarios } = useScenarios(SEASON)

      expect(scenarios.value).toHaveLength(1)
      expect(scenarios.value[0]!.name).toBe('Scenario 1')
    })
  })

  describe('createScenario', () => {
    it('appends a scenario named `Scenario ${N}` where N is the pre-call registry length + 1, and activates it', () => {
      const { scenarios, activeScenarioId, createScenario } = useScenarios(SEASON)
      const initialCount = scenarios.value.length // 1, from the auto-created default

      const created = createScenario()

      expect(scenarios.value).toHaveLength(initialCount + 1)
      expect(created.name).toBe(`Scenario ${initialCount + 1}`)
      expect(activeScenarioId.value).toBe(created.id)
    })

    it('uses the given name instead of the default', () => {
      const { createScenario } = useScenarios(SEASON)

      const created = createScenario('Custom Name')

      expect(created.name).toBe('Custom Name')
    })
  })

  describe('renameScenario', () => {
    it('updates only the target entry\'s name, leaving everything else untouched', () => {
      const { scenarios, activeScenarioId, createScenario, renameScenario } = useScenarios(SEASON)
      const other = createScenario('Other')
      const target = createScenario('Target')
      const activeBefore = activeScenarioId.value

      renameScenario(target.id, 'Renamed')

      const updated = scenarios.value.find(s => s.id === target.id)!
      const untouched = scenarios.value.find(s => s.id === other.id)!
      expect(updated.name).toBe('Renamed')
      expect(untouched.name).toBe('Other')
      expect(activeScenarioId.value).toBe(activeBefore)
    })

    // WR-01: a blank/whitespace-only name is silently ignored rather than persisted.
    it('is a no-op when the new name is empty or whitespace-only', () => {
      const { scenarios, createScenario, renameScenario } = useScenarios(SEASON)
      const target = createScenario('Target')

      renameScenario(target.id, '   ')

      expect(scenarios.value.find(s => s.id === target.id)!.name).toBe('Target')
    })

    // WR-01: trims surrounding whitespace and caps to MAX_SCENARIO_NAME_LENGTH.
    it('trims surrounding whitespace and caps an overlong name', () => {
      const { scenarios, createScenario, renameScenario } = useScenarios(SEASON)
      const target = createScenario('Target')
      const overlong = 'x'.repeat(100)

      renameScenario(target.id, `  ${overlong}  `)

      const renamed = scenarios.value.find(s => s.id === target.id)!.name
      expect(renamed).toBe(overlong.slice(0, 60))
      expect(renamed.length).toBe(60)
    })
  })

  describe('duplicateScenario', () => {
    it('copies all three storage kinds for a non-active source scenario into a new scenario named "{source} (copy)"', () => {
      const { scenarios, activeScenarioId, createScenario, duplicateScenario } = useScenarios(SEASON)
      const source = createScenario('Source')
      // Make a different scenario active, so `source` is NOT currently mounted.
      const other = createScenario('Other')
      expect(activeScenarioId.value).toBe(other.id)

      localStorage.setItem(scenarioKeys.picks(SEASON, source.id), JSON.stringify({ 1: 100 }))
      localStorage.setItem(scenarioKeys.autofilled(SEASON, source.id), JSON.stringify([1]))
      localStorage.setItem(scenarioKeys.manualTiebreakers(SEASON, source.id), JSON.stringify({ SEC: {} }))

      const copy = duplicateScenario(source.id)

      expect(copy).toBeDefined()
      expect(copy!.name).toBe('Source (copy)')
      expect(scenarios.value.some(s => s.id === copy!.id)).toBe(true)
      expect(localStorage.getItem(scenarioKeys.picks(SEASON, copy!.id))).toBe(JSON.stringify({ 1: 100 }))
      expect(localStorage.getItem(scenarioKeys.autofilled(SEASON, copy!.id))).toBe(JSON.stringify([1]))
      expect(localStorage.getItem(scenarioKeys.manualTiebreakers(SEASON, copy!.id))).toBe(JSON.stringify({ SEC: {} }))
    })

    it('copies only the storage kinds present, writing nothing for a kind the source scenario never persisted', () => {
      const { createScenario, duplicateScenario } = useScenarios(SEASON)
      const source = createScenario('Source')
      localStorage.setItem(scenarioKeys.picks(SEASON, source.id), JSON.stringify({ 1: 100 }))
      // no autofilled or manual-tiebreakers key ever written for `source`

      const copy = duplicateScenario(source.id)

      expect(copy).toBeDefined()
      expect(localStorage.getItem(scenarioKeys.picks(SEASON, copy!.id))).toBe(JSON.stringify({ 1: 100 }))
      expect(localStorage.getItem(scenarioKeys.autofilled(SEASON, copy!.id))).toBeNull()
      expect(localStorage.getItem(scenarioKeys.manualTiebreakers(SEASON, copy!.id))).toBeNull()
    })

    // WR-03: duplicateScenario no-ops (no registry entry, no key copies, no
    // activeScenarioId change) rather than fabricating a phantom empty
    // scenario when the source id doesn't exist.
    it('returns undefined and does not create a phantom scenario when the source id does not exist', () => {
      const { scenarios, activeScenarioId, duplicateScenario } = useScenarios(SEASON)
      const countBefore = scenarios.value.length
      const activeBefore = activeScenarioId.value

      const copy = duplicateScenario('does-not-exist')

      expect(copy).toBeUndefined()
      expect(scenarios.value).toHaveLength(countBefore)
      expect(activeScenarioId.value).toBe(activeBefore)
    })
  })

  describe('deleteScenario', () => {
    it('removes the scenario\'s three per-scenario keys and its registry entry', () => {
      const { scenarios, createScenario, deleteScenario } = useScenarios(SEASON)
      const target = createScenario('ToDelete')
      localStorage.setItem(scenarioKeys.picks(SEASON, target.id), JSON.stringify({ 1: 100 }))
      localStorage.setItem(scenarioKeys.autofilled(SEASON, target.id), JSON.stringify([1]))
      localStorage.setItem(scenarioKeys.manualTiebreakers(SEASON, target.id), JSON.stringify({ SEC: {} }))

      deleteScenario(target.id)

      expect(scenarios.value.some(s => s.id === target.id)).toBe(false)
      expect(localStorage.getItem(scenarioKeys.picks(SEASON, target.id))).toBeNull()
      expect(localStorage.getItem(scenarioKeys.autofilled(SEASON, target.id))).toBeNull()
      expect(localStorage.getItem(scenarioKeys.manualTiebreakers(SEASON, target.id))).toBeNull()
    })

    it('reassigns activeScenarioId to the new first registry entry when deleting the active scenario', () => {
      const { scenarios, activeScenarioId, createScenario, deleteScenario } = useScenarios(SEASON)
      createScenario('Other') // now active
      const activeId = activeScenarioId.value

      deleteScenario(activeId)

      expect(activeScenarioId.value).toBe(scenarios.value[0]!.id)
      expect(activeScenarioId.value).not.toBe(activeId)
    })

    it('is a complete no-op when the registry holds exactly one scenario', () => {
      const { scenarios, activeScenarioId, deleteScenario } = useScenarios(SEASON)
      expect(scenarios.value).toHaveLength(1)
      const onlyId = scenarios.value[0]!.id
      const activeBefore = activeScenarioId.value

      deleteScenario(onlyId)

      expect(scenarios.value).toHaveLength(1)
      expect(scenarios.value[0]!.id).toBe(onlyId)
      expect(activeScenarioId.value).toBe(activeBefore)
      expect(localStorage.getItem(scenarioKeys.picks(SEASON, onlyId))).toBeNull()
    })
  })
})
