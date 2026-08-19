# Handoff

## Last run — one story per player, and boards that agree with the recommender

Two asks, both about showing less: recommended picks that exclude players who
are gone, and a news feed that says a thing once.

Picks:
- `buildPositionBoards` now runs inside `src/components/LivePicks.tsx` rather
  than in `src/pages/picks.astro`, so the position boards re-derive from the
  live Sleeper snapshot exactly like the recommendations already did. The
  `boards` prop is gone.
- `src/lib/picks/board.ts` counts `boardLimit` against *available* players, so
  hiding taken names leaves a full board instead of a stub.
- `PicksApp` hides taken players by default.

News:
- `src/lib/news/dedupe.ts` gained `dedupeByPlayer`, `uniqueStories` and
  `headlineSubject`. `NewsPanel` applies it by default (the old "hide duplicate
  titles" checkbox is now "One story per player"); `src/pages/index.astro` uses
  it for the digest and drops digest items about a player the alerts already
  cover; `rosterAlerts` raises one alert per player; `compare.ts` dedupes each
  player's three-item news list by title before capping it.

Evidence: `check.sh passed` — typecheck 0 errors, vitest 689/689, build 28 pages.

## What the next run should know

- **The live Sleeper API is unreachable from the web sandbox** (403 at the
  egress proxy, same for every news feed host). `npm run sync:sleeper` and
  `npm run news:fetch` must run from a machine with network access or from the
  scheduled job; from a sandboxed session, read the committed snapshot and say
  so rather than reporting a refresh that did not happen.
- `headlineSubject` is a deliberately conservative heuristic: capitalized runs,
  minus teams/cities/positions/sports-page furniture, accepted only at two or
  three tokens. A missed collapse is one extra row; a wrong one hides a story.
  If a false collapse turns up, add the offending word to `NOT_A_NAME` rather
  than loosening the length rule.
- `rosteredInLeague` is false for every player in the committed snapshot, and
  that is correct: the startup is still drafting, so Sleeper's rosters are
  empty and `draft.picks` is the only ownership signal until it finishes.

## Open items — candidates for BACKLOG, not yet scheduled

- A shareable `?players=a,b` query param for a comparison (nothing persists the
  selection today).
- Delete unused `DraftPanel` once nothing imports it except its own tests.
- `headlineSubject` could reuse the fuller name list from `data/players.json`
  at build time to tag more items properly, rather than inferring at read time.
