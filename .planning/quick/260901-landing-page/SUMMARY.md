---
status: complete
---
Built a landing page for the homepage.

- app/pages/index.vue: removed the redirect to /week/1; now a real landing page composed of AppHeader, Hero, three UPageSection blocks (how it works, standings/tiebreakers, scenarios/sharing), and AppFooter
- app/components/AppHeader.vue: dropped unused useAuth/useCart-based cart+account UI (composables didn't exist), renamed brand to "Saturday Central", nav now links to on-page anchors, added a "Predict the Season" CTA to /week/1
- app/components/AppFooter.vue: replaced Lorem-ipsum ecommerce columns/newsletter with predictor-relevant links and copy
- app/components/Hero.vue: replaced Lorem ipsum defaults with CFB Predictions copy, removed unused/undefined ImagePlaceholder component and social-proof/review UI, generalized the highlighted-word logic via a `highlight` prop
- Fixed bug found during verification: AppHeader/AppFooter were never rendered anywhere in the app (app.vue only renders NuxtPage) — added them directly to index.vue
- Verified: `pnpm lint` passes except a pre-existing unrelated warning (Hero.vue single-word component name, present before this change)
