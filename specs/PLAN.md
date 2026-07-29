# Implementation Plan — ordered task checklist

> The `maker` executes the **single highest-priority unchecked** item per pass.
> Top of the list = do next. Keep tasks small, reversible, and independently
> verifiable. Every task must name its check.

Legend: `- [ ]` not done · `- [x]` done · each task ends with `(check: ...)`.

---

## Phase 0 — Reset to the dynasty app

- [x] Rewrite `specs/spec.md` for the dynasty fantasy football guide.
      (check: §6 acceptance table present; no `TODO` markers)
- [x] Rewrite `specs/PLAN.md`, `specs/STATUS.md`, `memory/handoff.md`; replace
      `docs/plan.md` with `docs/architecture.md`. (check: prior-product
      references survive only as history in `STATUS.md`/`handoff.md`)
- [x] Strip `GEMINI_API_KEY` from `.env.example` and the Gemini guardrail line
      from `AGENTS.md`; rewrite the app sections of `README.md`; delete the
      `site/` placeholder. (check: no `GEMINI_API_KEY` in the tree)

## Phase 1 — Scaffold

- [x] Scaffold Astro 7 (static, `base: '/loop'`) with `@astrojs/react`, Tailwind
      v4, TypeScript strict, Vitest. (check: `npm run build` exits 0; `url.ts`
      base-path tests pass)
- [x] Add `typecheck`, `test`, `build` npm scripts so `scripts/check.sh` picks
      them up. (check: `scripts/check.sh` exits 0)
- [x] Fix the latent `has_script` bug in `scripts/check.sh` — `process.exit()`
      rejects booleans on Node ≥ 22, so the check silently skipped every npm
      script. (check: `check.sh` now runs typecheck/test/build)
- [x] Retire the `site/` placeholder now that `dist/` is the deploy artifact.
      (check: `pages.yml` build step resolves `path=dist`)

## Phase 2 — Data layer

- [ ] Add Zod schemas in `src/lib/schemas/` for feeds, news, players, team,
      insights. (check: unit test per schema — valid parses, invalid throws)
- [ ] Add seed `data/feeds.json`, `data/players.json`, `data/team.json`,
      empty `data/news.json` and `data/insights.json`. (check: schema tests
      validate every committed data file)
- [ ] Add typed data loaders in `src/lib/data/` that parse at import time.
      (check: unit test — a malformed fixture throws with a useful message)
- [ ] Configure the `knowledge` content collection with the frontmatter contract
      and the fixed facet list in `src/lib/knowledge/facets.ts`. (check:
      collection schema test; unknown facet rejected)

## Phase 3 — App shell

- [ ] Build `BaseLayout.astro`: nav rail + main column + right news panel,
      dark-mode-aware tokens, dense typographic scale. (check: build passes;
      layout test asserts all three regions)
- [ ] Build `NewsPanel` island rendering newest items with source + relative
      time. (check: component test renders N items, newest first)
- [ ] Make the panel a drawer below `lg` with a toggle. (check: component test
      on open/close state)

## Phase 4 — News pipeline

- [ ] Add `scripts/fetch-news.ts` with `fast-xml-parser`: RSS + Atom → normalized
      items, stable id from canonical URL. (check: unit tests over
      `tests/fixtures/rss.xml` and `atom.xml`, offline)
- [ ] Add merge/dedupe + retention cap in `src/lib/news/merge.ts`. (check: unit
      test — same fixture twice yields no duplicate ids; cap enforced)
- [ ] Add `--fixtures` offline mode and `npm run news:fetch`. (check: running it
      offline writes a schema-valid `data/news.json`)
- [ ] Build `/news` archive with source/tag/team filters. (check: component test
      filters narrow the list)
- [ ] Add `.github/workflows/news.yml` — cron + `workflow_dispatch`, commit only
      on change. (check: `workflow_dispatch` present; commit step guarded by
      `git diff --quiet`)

## Phase 5 — Team page

- [ ] Build roster view grouped by slot from `data/team.json`. (check: component
      test — one row per slot, starters/bench grouped)
- [ ] Build the alternatives/targets list per slot with rationale + priority.
      (check: component test — targets render under their slot)
- [ ] Build editable budget ledgers (auction + FAAB) with
      `remaining = total − allocated`. (check: unit test on the math; component
      test on edit)
- [ ] Add the localStorage overlay + JSON export. (check: round-trip test parses
      against `TeamSchema`)

## Phase 6 — Knowledge base

- [ ] Build `/knowledge` facet index with article counts and last-updated.
      (check: route test lists all facets)
- [ ] Build `/knowledge/[facet]` and `/knowledge/[facet]/[slug]` with sources,
      confidence, and updated date. (check: route test — facet page lists only
      its own articles)
- [ ] Add the ≥1-source content test. (check: a sourceless fixture article fails
      the test)
- [ ] Seed one substantive article per facet. (check: every facet has ≥1 article;
      facet index shows no empty facets)

## Phase 7 — Dashboard

- [ ] Add the roster × news cross-reference selector in
      `src/lib/insights/cross-reference.ts`. (check: unit test — fixture news
      mentioning a rostered player is flagged, others are not)
- [ ] Build `/` dashboard: latest digest, roster alerts, stale-knowledge nudges.
      (check: component test renders all three sections)

## Phase 8 — Loops, skills, ship

- [ ] Add `loops/news-refresh.md`, `loops/knowledge-curator.md`,
      `loops/roster-review.md` per `loops/_template.md`. (check: each names all
      five parts and a mechanical check)
- [ ] Add the `curate-knowledge` skill in `skills/`. (check: `SKILL.md` follows
      the existing skill format)
- [ ] Update `README.md` and `docs/` for the dynasty app + new loops. (check: no
      dead links; quick start runs)
- [ ] Final green pass: `scripts/check.sh` exits 0, checker approves, append
      `ALL TASKS DONE` to `specs/STATUS.md`. (check: sentinel present)

---

<!--
When every box above is checked and `scripts/check.sh` is green, the maker writes
"ALL TASKS DONE" to specs/STATUS.md. Discovered work becomes NEW unchecked items
here — do not silently expand an in-progress task.
-->
