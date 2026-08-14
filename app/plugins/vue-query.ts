import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

/**
 * Registers a single app-wide QueryClient. `staleTime`/`gcTime` are both
 * `Infinity` because the schedule/team datasets are immutable static JSON
 * for the lifetime of a session (FOUND-03) — there is nothing to
 * revalidate. No dehydrate/hydrate server branches: this app runs with
 * `ssr: false`, so there is no server render to dehydrate from.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity
      }
    }
  })

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
})
