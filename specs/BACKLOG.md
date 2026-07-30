# Backlog — the intake queue

> Ideas and discovered work that are **not yet scheduled**. `specs/PLAN.md` is
> what the loop executes; this is where everything else waits so it is neither
> forgotten nor silently smuggled into an in-progress task.
>
> The loop reads this file fresh, like everything else in `specs/`. Keep it on
> disk, not in anyone's head.

## The promotion path

```
idea → BACKLOG.md → (has a named check?) → PLAN.md task → done → STATUS.md evidence
```

An item **cannot** move to `specs/PLAN.md` until it has a mechanical check —
"what test proves this is done?" If you cannot name one, the item is not ready;
sharpen it here first. That gate is the whole reason this file exists separately
from the plan.

## Format

`- [P?] <title> — <why it matters> (size: S/M/L · check: <how we'd prove it>)`

Priority: `P0` needed for correctness or trust · `P1` clear value, next up ·
`P2` worth doing · `P3` someday. Delete items that stop being true rather than
letting them rot.

---

## P0 — correctness and trust

- [P0] **Run the independent checker on the current build.** `CHECKER_CMD` is
  unset, so nothing has adversarially graded the work; `specs/spec.md` §10 says
  the build is not done until it has. (size: S · check: `CHECKER_CMD=... scripts/verify.sh`
  prints APPROVE, then the `ALL TASKS DONE` sentinel goes in)
- [P0] **Replace the fixture-era `tier` and `notes` on synced players.** The sync
  fills `tier` from `defaultTier()` — age and position only — and 48 of the 56
  synced players have an empty `notes`. That is a placeholder judgement sitting
  in the same field as a real one. (size: M · check: no shortlisted player
  retains a default tier with an empty note)
- [P0] **Confirm the draft details against the Sleeper app.** The live sync
  reports snake, 12 teams, 30 rounds, 2026-08-14. Order is not set yet, so the
  slot-to-picks path is still fixture-only. (size: S · check: date/type/rounds
  match Sleeper, and once the order is drawn, pick 1 equals your slot)
- [P0] **Verify the pre-draft player pool against the live Sleeper dump.** The
  fix that pulls ~250 top-`search_rank` players (instead of only rostered/
  trending ones) is proven only against a synthetic fixture — this sandbox
  cannot reach `api.sleeper.app`. The bug it fixes was real: the live sync had
  only 8 QBs in a superflex league. (size: S · check: after a live `refresh`,
  `data/players.json` has QBs in the dozens, not single digits, and the share
  of `data/news.json` items matching a known player rises well above the
  16/147 seen before the fix)

## P1 — next up

- [P1] **A real draft board — the startup is 2026-08-14, so this has a deadline.**
  The shortlist is 8 targets; a startup is 30 rounds.
  A tiered board you can work down live — filter by position, mark players gone,
  see who is left in each tier — is the thing you would actually have open on
  draft night. (size: L · check: board renders every rostered-eligible player by
  tier, and marking one gone removes it everywhere)
- [P1] **Rookie-pick assets.** Dynasty rosters hold future picks; `data/team.json`
  has no concept of one, so trade capital is invisible. (size: M · check: picks
  render as assets with schema + component tests)
- [P1] **League transactions view.** Sleeper exposes trades and waiver claims per
  week — seeing what the league just did is most of scouting your leaguemates.
  (size: M · check: a route lists the last N transactions with a schema test over
  a fixture)

## P2 — worth doing

- [P2] **Player detail route.** One page per player pulling together their news,
  market activity, and the knowledge articles that mention their archetype.
  (size: M · check: route test renders all three sections for a fixture player)
- [P2] **Value tracking over time.** Snapshot a value signal per player per week
  so the app can show direction, not just level. (size: L · check: a time series
  renders from committed snapshots; no network at build)
- [P2] **Injury status on the roster.** Sleeper returns `injury_status`; it is
  parsed but not surfaced. (size: S · check: injured starters are flagged on
  `/team`)
- [P2] **Weekly digest article.** Have the curator loop write a dated summary of
  what changed, as a knowledge article in its own facet. (size: M · check: the
  article exists, cites news ids, and passes the source test)

## P3 — someday

- [P3] **Trade evaluator.** Given players in and out, report the age/positional
  shape change against the roster's window. (size: L · check: unit tests over
  known-good and known-bad trades)
- [P3] **Multiple leagues.** The schema assumes one. (size: L · check: two
  leagues render independently)
- [P3] **Push notification on a roster alert.** Currently you have to open the
  app. (size: M · check: a real notification fires from CI on a fixture alert)

---

## Done — promoted and shipped

Items graduate out of this file when they land; the record lives in
`specs/STATUS.md`, not here. Deleting a shipped item from this list is correct.
