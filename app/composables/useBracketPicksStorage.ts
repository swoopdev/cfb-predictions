import type { Ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { emptyBracketPicks, validateBracketPicks } from '#shared/domain/playoff/scenarioExtras'
import type { StoredBracketPicks } from '#shared/domain/playoff/scenarioExtras'
import { scenarioKeys } from '~/utils/scenarioKeys'

export type { BracketKind, StoredBracketPicks } from '#shared/domain/playoff/scenarioExtras'

/**
 * CFP bracket picks for one scenario, one map per bracket (the "if the
 * season ended today" bracket and the scenario's projected one), persisted
 * like every other scenario-scoped key. Picks are keyed by bracket slot,
 * not by team, so a pick for a team that's no longer in that slot is simply
 * ignored by `resolveBracket` rather than lost.
 */
export function useBracketPicksStorage(scenarioId: string, season = 2026): Ref<StoredBracketPicks> {
  return useStorage<StoredBracketPicks>(
    scenarioKeys.bracketPicks(season, scenarioId),
    emptyBracketPicks(),
    localStorage,
    {
      mergeDefaults: true,
      serializer: {
        read(v: string) {
          try {
            return validateBracketPicks(JSON.parse(v))
          } catch {
            return emptyBracketPicks()
          }
        },
        write(v: StoredBracketPicks) {
          return JSON.stringify(v)
        }
      }
    }
  ) as Ref<StoredBracketPicks>
}
