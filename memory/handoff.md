# Handoff

## Last run — Phase 14, `/picks`

Shipped a `/picks` page: one list per position, ordered by popularity, from two
real sources kept separate — FantasyPros ECR (`data/market.json`) for the draft
board, Sleeper 24h add counts (`data/trending.json`) for the waiver wire. Rows
are flagged `drafted` (from `data/draft.json`) or `rostered` (from
`players[].rosteredInLeague`) so the next available name is one glance away.
`scripts/check.sh` green: 620 tests, 27 pages.

New surface area:
- `src/lib/picks/board.ts` — `buildPositionBoards()`, format-aware (superflex
  reads the 2QB sheet), joins trending ↔ market ↔ players by id then name+pos.
- `src/components/PicksApp.tsx` — board/trending switch, hide-taken toggle, name
  filter; all three apply to every position at once.
- `src/pages/picks.astro`, nav entry, `'/picks': 'pink'` in `ROUTE_TONES`.
- `tests/picks-board.test.ts`, `tests/picks-app.test.tsx`.

## What the next run should know

The rule from Phase 13 held again: run an `npx tsx` probe over the committed
data before trusting an ordering. The board was checked that way (Allen/Chase/
Bowers at the top of their positions) — the tests alone would not have caught a
wrong sheet being read.

## Open items — candidates for BACKLOG, not yet scheduled

- Sleeper's trending endpoint returns ~25 players league-wide, so QB and TE
  trending lists are 2 rows deep in August. Consider a per-position trending
  fetch if the in-season lists still read thin.
- `/picks` currently shows the top 40 per position; there is no "show more".
- Carried over: unverified per-player deep-link path shapes in
  `src/lib/market/dynastyprocess.ts`; `MarketPickRow.valueSf` always null;
  `/builds` serializes all seven plans.
- Once the draft starts on 2026-08-14, `draft.picks` fills in — the `drafted`
  flag on `/picks` goes live then and should be spot-checked against the room.
