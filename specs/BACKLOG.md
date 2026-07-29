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
- [P0] **Verify the first live Sleeper sync.** The mapping is tested only against
  fixtures; this container cannot reach the API. The real league may have slot
  kinds or settings the mapper skips. (size: S · check: dispatch `refresh.yml`,
  confirm the committed roster matches the Sleeper app slot for slot)

## P1 — next up

- [P1] **Replace remaining seed player notes and tiers.** Sleeper supplies name,
  team, and age; `tier` and `notes` are still defaults from `defaultTier()`.
  (size: M · check: no player retains a default note; spot-check ten rows)
- [P1] **League transactions view.** Sleeper exposes trades and waiver claims per
  week — seeing what the league just did is most of scouting your leaguemates.
  (size: M · check: `/team` or a new route lists the last N transactions with a
  schema test over a fixture)
- [P1] **Rookie-pick assets on the roster.** Dynasty rosters hold future picks;
  `data/team.json` currently has no concept of one. (size: M · check: picks
  render as assets and count toward trade capital, with schema + component tests)

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
