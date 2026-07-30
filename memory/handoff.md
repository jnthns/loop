# Handoff

## Last run — Phase 13, `/builds`

Shipped a new `/builds` page: seven startup archetypes scored against this
league's format and draft slot, plus targets for all 30 owned picks, every
claim carrying its arithmetic and every reference hyperlinked. Eight commits,
`da1ca97`..`2e18f2e`, all pushed to `main`. `scripts/check.sh` green.

New surface area:
- `scripts/sync-market.ts` → `data/market.json` (`npm run sync:market`), wired
  into `refresh.yml` with `continue-on-error`, like the Sleeper step.
- `src/lib/market/` — CSV parser, DynastyProcess typed rows, the id join.
- `src/lib/builds/` — archetypes, `scoreArchetypes()`, `planPicks()`.
- `src/content/builds/*.md` — cited archetype prose, schema-enforced.
- `src/pages/builds.astro` + `src/components/builds/`.

## What the next run should know

**Verify model output against the real board, not just the tests.** Three
scoring bugs shipped green test suites in this phase — the tests asserted what
the code did, not what a fantasy roster needs. A `npx tsx` scratch script
against `data/market.json` caught all three. Do that before trusting a number.

**Never fabricate a citation URL.** Egress policy blocks every host except
`raw.githubusercontent.com`, so a wrong URL cannot be caught by fetching it.
Cite from `data/news.json` (real, CI-harvested) or the stable index pages
already used in `src/content/knowledge/`.

## Open items — candidates for BACKLOG, not yet scheduled

- Per-player deep links are unverified path shapes. Spot-check them in a real
  browser and correct the single table in `src/lib/market/dynastyprocess.ts`.
- `values-picks.csv` carries no value column, so `MarketPickRow.valueSf` is
  always null; rookie-pick values are ECR-only. Either drop the field or find
  a source that has one.
- `/builds` ships 1.1 MB (136 KB gzipped) because all seven plans are
  serialized. Only the selected plan needs to be eager.
- Once the draft starts on 2026-08-14, `draft.picks` fills in; the sheet should
  consume real picks instead of the simulated room.
