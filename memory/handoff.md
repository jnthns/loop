# Handoff

## Last run — Phase 16, roster health panel

Replaced the `/team` pick schedule and draft shortlist with a **Where this
roster is weak** panel. It grades the current roster against 2026 superflex
criteria from cited web and YouTube sources, then lists weak/watch rooms first.

New surface area:
- `src/lib/team/health.ts` — `diagnoseRosterHealth()`, RSJ 0–40 window bands
- `src/components/RosterHealthPanel.tsx`
- `tests/roster-health.test.tsx`

`DraftPanel` still exists and is unit-tested in isolation; TeamApp no longer
mounts it.

Evidence: typecheck 0 errors, vitest **652/652**, build 28 pages.

## What the next run should know

- Click **Refresh from Sleeper** first so the health panel sees live roster
  assignments, not an empty committed file.
- Grades use stored `tier` / `age` / injury — defaulted tiers from the sync
  are still coarse (BACKLOG P0).
- DraftPanel remains in the tree for now; delete it in a later pass if unused.

## Open items — candidates for BACKLOG, not yet scheduled

- Delete unused `DraftPanel` once nothing imports it except its own tests.
- PicksApp still does not listen for the live Sleeper refresh event.
