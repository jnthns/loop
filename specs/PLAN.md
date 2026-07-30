# Implementation Plan — ordered task checklist

> The `maker` executes the **single highest-priority unchecked** item per pass.
> Top of the list = do next. Keep tasks small, reversible, and independently
> verifiable. Every task must name its check.

Legend: `- [ ]` not done · `- [x]` done · each task ends with `(check: ...)`.

---

## Phase 0 — Bootstrap

- [x] Fill in `specs/spec.md` — replace all `TODO`s; define goals + acceptance
      criteria. (check: no `TODO` markers remain in `specs/spec.md`)
- [x] Choose the tech stack and record it in `specs/spec.md` §5. (check: Astro
      stack stated in spec)
- [x] Configure GitHub Pages CI/CD — push to `main` runs check + deploy.
      (check: `.github/workflows/pages.yml` exists; `site/` placeholder until
      Astro build exists)
- [x] Scaffold Astro project (`output: 'static'` for GitHub Pages) with React,
      Vitest, Framer Motion, Syne font. (check: `npm run build` exits 0; one
      trivial passing test)

## Phase 1 — Foundation

- [x] Add brutalist design tokens + shared UI primitives (`BrutalPanel`,
      `BrutalButton`, `BrutalSelect`, `BrutalInput`). (check: components render
      in Storybook-free smoke test or unit snapshot)
- [x] Add dropdown option constants + Zod types in `src/lib/recipes/options.ts`
      and `schema.ts`. (check: unit test validates option lists + schema parse)
- [x] Implement Gemini client in `src/lib/gemini/client.ts` using `@google/genai`
      and model `gemini-3.1-flash-lite`. (check: unit test with mocked SDK)
- [x] Implement Gemini explicit context cache in `src/lib/gemini/recipe-cache.ts`.
      (check: unit test verifies cache name returned and passed to generateContent)
- [x] Implement server in-memory recipe cache in `src/lib/recipes/cache.ts`.
      (check: unit test — duplicate key returns cached result, no second Gemini call)
- [x] Implement recipe generation orchestration in `src/lib/recipes/generate.ts`
      incl. mock fallback when `GEMINI_API_KEY` unset. (check: unit test returns
      6 valid recipes)
- [x] Add `POST /api/recipes/generate` Astro endpoint. (check: integration test
      returns JSON array of 6 recipes)

## Phase 2 — Landing page

- [x] Create `BaseLayout.astro` with Syne font + brutalist global styles.
      (check: build passes)
- [x] Build `FilterBar.tsx` — 3 dropdowns, extra-ingredients input, Generate
      button. (check: component test renders all controls)
- [x] Build `RecipeCard.tsx` + `RecipeGrid.tsx` — 3-col alternating masonry,
      Framer Motion stagger on refresh. (check: component test renders 6 cards
      with column flip)
- [x] Build `LandingApp.tsx` + `src/pages/index.astro` — random load on mount,
      generate on confirm, sessionStorage write, card navigation. (check:
      integration test: mount fetches recipes; Generate re-fetches)

## Phase 3 — Detail page

- [x] Build detail components: `RecipeHero`, `IngredientsPanel`, `MetadataBar`,
      `InstructionsPanel`, `ProChefTipsPanel`. (check: component tests render
      expected sections)
- [x] Build `DetailApp.tsx` + `src/pages/recipe/[id].astro` — load from
      sessionStorage/localStorage; save toggle; display toggle for pro tips.
      (check: component test: save writes localStorage; toggle hides tips panel)

## Phase 4 — Harden

- [x] Add localStorage helpers with dedupe + 50-recipe FIFO cap in
      `src/lib/storage/saved-recipes.ts`. (check: unit tests)
- [x] Add sessionStorage helpers in `src/lib/storage/recipe-session.ts`.
      (check: unit tests)
- [x] Add placeholder gradient utility in `src/lib/recipes/placeholders.ts`.
      (check: unit test — same title → same gradient)
- [x] Wire `scripts/check.sh` to Astro lint/test/build; update `.env.example`
      with `GEMINI_API_KEY`. (check: `scripts/check.sh` exits 0)
- [x] Update README with app quick-start (dev, env, loop). (check: README
      documents `npm run dev` + `GEMINI_API_KEY`)

---

## Campaign 2 — NFL Team Investment Board (feature/teams-draft-board)

- [x] Build `src/lib/nfl/` data layer — types, curated 32-team coach profiles,
      ESPN fetchers (standings, injuries, news), Sleeper fetchers (players,
      trending adds), in-memory TTL cache, offline mock inputs. (check: unit
      tests in `src/lib/nfl/nfl.test.ts`)
- [x] Build recommendation engine `src/lib/nfl/recommend.ts` — win/loss grouping,
      per-position pick selection, 0–100 scoring (rank + team context + health +
      trending + scheme fit + news sentiment), verdicts, why-pick/build-fit copy.
      (check: unit tests cover grouping, injury AVOID, trending, copy)
- [x] Add `GET /api/nfl/board` endpoint with per-source mock fallback. (check:
      integration test `src/lib/nfl/api-board.integration.test.ts`)
- [x] Build Teams UI — two group sections, per-team wide carousel with sticky
      collapsible coach tile, small player tiles, selected-player profile panel
      defaulting to the team recommendation. (check: component tests in
      `src/components/teams/TeamsApp.test.tsx`)
- [x] Add `/teams` page + cross-links with landing. (check: `npm run build`
      emits `/teams/index.html`)
- [ ] Add sessionStorage persistence for the Sleeper player index so client-side
      loads skip the multi-MB re-download. (check: unit test round-trip)
- [ ] Refresh curated coach profiles after 2026 offseason staff changes; verify
      against current rosters. (check: manual review of `coaches.ts`)

<!--
When every box above is checked and `scripts/check.sh` is green, the maker writes
"ALL TASKS DONE" to specs/STATUS.md. Discovered work becomes NEW unchecked items
here — do not silently expand an in-progress task.
-->
