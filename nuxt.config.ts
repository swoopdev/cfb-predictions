import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Read at config-eval time (Node, build-only) rather than importing the JSON
// into the bundle — this file is committed static data (PROJECT.md), and the
// sitemap only needs the id list, not the full payload shipped to the client.
const teamsDataPath = fileURLToPath(new URL('./public/data/2026/teams.json', import.meta.url))
const teamIds: number[] = JSON.parse(readFileSync(teamsDataPath, 'utf-8')).teams.map((team: { id: number }) => team.id)

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxtjs/seo'
  ],

  ssr: false,

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  site: {
    // TODO: replace with the real production URL once it's finalized.
    url: process.env.NUXT_PUBLIC_SITE_URL || 'https://www.saturdaycentral.com',
    name: 'Saturday Central',
    description: 'Predict every FBS college football game, get real conference standings and tiebreakers, and share your scenario with a link.',
    defaultLocale: 'en'
  },

  routeRules: {
    '/': { prerender: true }
  },

  compatibilityDate: '2026-06-30',

  nitro: {
    prerender: {
      routes: [
        '/week/1',
        '/week/2',
        '/week/3',
        '/week/4',
        '/week/5',
        '/week/6',
        '/week/7',
        '/week/8',
        '/week/9',
        '/week/10',
        '/week/11',
        '/week/12',
        '/week/13',
        '/week/15',
        '/sitemap.xml',
        '/robots.txt'
      ]
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  ogImage: {
    enabled: false
  },

  // Disabled: nuxt-schema-org@6.3.1 imports `hasOwn` from `unhead/utils`,
  // which isn't exported by the `unhead@2.1.15` that @nuxt/ui@4.10.0 pins
  // via @unhead/vue — two unhead majors coexist in the tree and this
  // submodule resolves the wrong one, crashing the build. Sitemap/robots
  // (what was actually requested) don't hit this path.
  schemaOrg: false,

  sitemap: {
    urls: () => [
      ...WEEKS.map(week => `/week/${week}`),
      ...teamIds.map(id => `/team/${id}`)
    ]
  }
})
