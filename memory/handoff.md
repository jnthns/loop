# Handoff

## Last run — the app was naming the wrong picks as yours

The ask was "the latest Sleeper fetch, especially around my next picks". The
fetch could not happen from this sandbox (see below), but the picks half turned
out to be a real defect rather than a staleness problem.

- **Third-round reversal.** This league's draft turns after round 2 *and* after
  round 3, so from round three on the old every-even-round arithmetic named the
  wrong pick numbers. `src/lib/picks/pick-math.ts` now owns the arithmetic
  (`roundIsReversed`, `pickNumbersForSlot`, `pickCoordinate`, `formatPickNumber`,
  `inferReversalRound`), `Draft` carries `reversalRound`, and `toDraft` infers it
  from the picks already made, falling back to `settings.reversal_round`.
- **`myPicks` reconciles two sources:** picks this roster actually made (from
  `picks[].mine`) plus the scheduled picks still ahead of the last pick made.
- **`data/draft.json` was rewritten in place** with the corrected `myPicks`
  (4, 21, 33, 40, 57, 64, 81, 88, 105, …) and `reversalRound: 3`. The next
  scheduled sync produces the same values on its own.
- **`/picks` gained a next-picks strip** (`src/components/NextPicks.tsx`,
  mounted inside `LivePicks` so it re-derives on a live refresh): next pick,
  how many managers pick first, and the wait before each following turn.
- **`getDraftProgress` gained `picksAhead`** — the picks *others* make before
  your turn. `picksUntilNextTurn` still counts your own pick and is left alone
  for callers that already read it.

Evidence: `check.sh passed` — typecheck 0 errors, vitest 708/708, build 28 pages.

## What the next run should know

- **The live Sleeper API is still unreachable from the web sandbox** — the
  egress proxy answers 403 to `CONNECT api.sleeper.app:443`, same for the news
  feed hosts. `npm run sync:sleeper` and `npm run news:fetch` must run from a
  machine with network access or from the scheduled job. From a sandboxed
  session, read the committed snapshot and say so rather than reporting a
  refresh that did not happen.
- `inferReversalRound` needs at least two picks in consecutive rounds to read a
  direction, so before a draft opens it returns 0 and the Sleeper setting is the
  only signal. If a league ever turns out to use a reversal round Sleeper does
  not report and the draft has not started, the first two rounds are still
  correct and the numbers self-correct once round 3 begins.
- `rosteredInLeague` is still false for every player in the committed snapshot,
  and that is correct while the startup is drafting: `draft.picks` is the only
  ownership signal until it finishes.

## Open items — candidates for BACKLOG, not yet scheduled

- A shareable `?players=a,b` query param for a comparison.
- Delete unused `DraftPanel` once nothing imports it except its own tests —
  nothing mounts it, and it duplicates part of what the new next-picks strip
  does.
- "Who is likely gone before your next turn" — the strip knows the wait and the
  board knows the ranking; nothing yet crosses them.
- `headlineSubject` could reuse the fuller name list from `data/players.json` at
  build time rather than inferring at read time.
