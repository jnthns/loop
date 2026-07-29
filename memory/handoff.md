# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

The app is built and connected to the real league. Remaining work is verifying
the first live data pull and whatever `specs/BACKLOG.md` promotes next.

## Last pass did

- Fixed red CI (no `npm ci` before `check.sh` — `astro: not found`, exit 127).
- Added the keyless Sleeper sync, ESPN's JSON news API, and `data/trending.json`.
- Replaced `news.yml` with `refresh.yml` (sync → fetch → check → commit → push).
- Added `specs/BACKLOG.md`, `npm run progress`, and the `/progress` route.
- Added the ship-to-main rule; merged this work to `main`.

## Evidence

- `scripts/check.sh`: typecheck 0 errors, 299 tests, 23 pages, passed.
- `npm run sync:sleeper -- --fixtures`: 13/20 slots, 22 players, 8 targets kept.
- `npm run progress`: 41/42 plan tasks, 12 backlog items (2 × P0).

## Blockers / needs a human

1. **The first live refresh has not run.** This container's proxy blocks
   api.sleeper.app and the news hosts, so every network path is fixture-tested
   only. Dispatch `refresh.yml` and read the log. Two things to check: the
   resolved league is the right one, and the synced roster matches the Sleeper
   app slot for slot.
2. **If the account has several NFL leagues,** the sync stops and writes them to
   `data/sleeper.json` as `candidateLeagues`. Pick one, set `leagueId`, commit.
3. **The independent checker still has not run.** `CHECKER_CMD` is unset, so
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
