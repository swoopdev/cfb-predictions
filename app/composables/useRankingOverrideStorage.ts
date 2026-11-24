import type { Ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { validateRankingOverride } from '#shared/domain/playoff/scenarioExtras'
import { scenarioKeys } from '~/utils/scenarioKeys'

/**
 * The user's drag-reordered projected CFP ranking for one scenario (team
 * ids, best first). Empty means "use the committee model's order". Teams the
 * model ranks but the override doesn't mention slot in after it, in model
 * order -- see `applyRankingOverride`.
 */
export function useRankingOverrideStorage(scenarioId: string, season = 2026): Ref<number[]> {
  return useStorage<number[]>(
    scenarioKeys.rankingOverride(season, scenarioId),
    [],
    localStorage,
    {
      serializer: {
        read(v: string) {
          try {
            return validateRankingOverride(JSON.parse(v))
          } catch {
            return []
          }
        },
        write(v: number[]) {
          return JSON.stringify(v)
        }
      }
    }
  ) as Ref<number[]>
}

/**
 * Merges an override into the model's full order: the override's teams
 * first, in its order, then every other team in model order.
 */
export function applyRankingOverride(modelOrder: readonly number[], override: readonly number[]): number[] {
  if (override.length === 0) return [...modelOrder]
  const known = new Set(modelOrder)
  const head = override.filter(id => known.has(id))
  const headSet = new Set(head)
  return [...head, ...modelOrder.filter(id => !headSet.has(id))]
}
