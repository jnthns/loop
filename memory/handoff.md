# Handoff

## Last run — `/compare` replaces `/builds`

Deleted the builds page and its whole support tree (component, `src/lib/builds`,
the `builds` content collection, four test suites) and shipped `/compare` in its
place: a player-vs-player page that holds two to four players against every
source this site pulls.

New surface area:
- `src/lib/compare/compare.ts` — `buildDossiers()` (build-time join of market,
  Sleeper, nflverse, news, profiles) and `compare()` (pure, runs in the browser)
- `src/components/compare/CompareApp.tsx`
- `src/pages/compare.astro`
- `tests/compare.test.ts`, `tests/compare-app.test.tsx`

Evidence: typecheck 0 errors, vitest **663/663**, build 28 pages.

## What the next run should know

- Rows are grouped by upstream family on purpose. FantasyPros ECR and the
  DynastyProcess value share a provenance and are badged as such; Sleeper is the
  only independent read. Do not "simplify" the page into one flat ranking table —
  that is the exact failure the grouping exists to prevent.
- `compare()` returns `agreement: 'unknown'` whenever a read saw fewer than two
  of the selected players. A one-horse race is not agreement.
- The page ships a dossier per skill-position player (~350KB of JSON, in line
  with `/team` and `/picks`). If that becomes a problem, trim the news objects
  first — only title, url, source, and publishedAt are rendered.
- The positional-builds knowledge article survived the deletion and is still
  linked from `DraftPanel`; only the page machinery went.

## Open items — candidates for BACKLOG, not yet scheduled

- A shareable `?players=a,b` query param for a comparison (nothing persists the
  selection today).
- Delete unused `DraftPanel` once nothing imports it except its own tests.
- PicksApp still does not listen for the live Sleeper refresh event.
