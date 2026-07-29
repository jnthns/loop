# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

The app is built and connected to the real league. Remaining work is verifying
the first live data pull and whatever `specs/BACKLOG.md` promotes next.

## Last pass did

- Fixed red CI (no `npm ci` before `check.sh` — `astro: not found`, exit 127).
  `verify` and `pages` are now green on `main`; the site deployed.
- Added the keyless Sleeper sync, ESPN's JSON news API, and `data/trending.json`.
- Replaced `news.yml` with `refresh.yml` (sync → fetch → check → commit → push).
- Added `specs/BACKLOG.md`, `npm run progress`, and the `/progress` route.
- Added the ship-to-main rule; merged to `main`.
- **Decoupled the tests from the synced data files** after the first live sync
  turned CI red. Behavior tests now use `tests/fixtures/league.ts`;
  `tests/data-coupling.test.ts` stops the coupling coming back.

## Evidence

- `scripts/check.sh`: typecheck 0 errors, 318 tests, 23 pages, passed.
- `verify` #7 and `pages` #3 green on `main` (commit `6d326b0`).
- The first live `refresh` proved the sync works: it read the real league, which
  has **no taxi and no IR slots**, and preserved the auction budget and targets.

## Blockers / needs a human

1. **Confirm the live roster is right.** The sync ran but its output was never
   committed (the run failed on the coupled tests before the commit step). Open
   the app after the next `refresh` and check the roster slot for slot against
   Sleeper. Tracked as P0 in `specs/BACKLOG.md`.
2. **The independent checker still has not run.** `CHECKER_CMD` is unset, so
   nothing has adversarially graded any of this. Tracked as P0 in the backlog.

## Constraints worth re-reading before coding

- **Ship to `main` directly.** No PRs. See `skills/ship-to-main/SKILL.md`.
- **Builds must never require network.** All fetching happens in `refresh.yml`.
- **No API keys anywhere** — Sleeper and ESPN are both keyless.
- `base: '/loop'` — internal links go through `src/lib/url.ts` or Pages 404s.
- **No uncited claims**, and no fabricated data: counts are not news, and the
  sync writes nothing on failure rather than guessing.
- **Discovered work goes to `specs/BACKLOG.md`,** and only reaches
  `specs/PLAN.md` once it has a named mechanical check.

## Next step

- Dispatch `refresh.yml`, confirm it and `pages.yml` go green, and check the site
  at https://jnthns.github.io/loop/.
- Then work the P0 items in `specs/BACKLOG.md`.
