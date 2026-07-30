# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

Campaign 2: NFL Team Investment Board (`/teams`) — live on branch
`feature/teams-draft-board`, not yet merged to `main`.

## Last pass did

- Built `/teams` page: winning vs losing carousels, sticky collapsible coach
  tile, player tiles, selected-player profile with recommendation copy.
- Data layer `src/lib/nfl/`: ESPN standings/injuries/news + Sleeper players/
  trending; per-source mock fallback; 30-min in-memory cache; mock board for
  offline/CI. Client island imports `getTeamBoard()` directly (static-Pages
  friendly); `/api/nfl/board` GET endpoint also prerenders a snapshot.
- Reconciled a mid-run collision with a second agent editing the same files
  (restored server-side fetchers; kept its WSH→WAS fix, per-source fallback,
  and direct-import TeamsApp design).
- Moved route test out of `src/pages/` (Astro treats every `.ts` there as an
  endpoint; test files importing vitest break static builds). Convention:
  route tests live in `src/lib/<area>/api-*.integration.test.ts`.

## Evidence

- lint/test/build green: astro check 70 files 0 errors; 90/90 tests; 8 pages
  built incl. `/teams/index.html` (see specs/STATUS.md Pass 22).

## Blockers / needs a human

- Merge `feature/teams-draft-board` → `main` to deploy (user isolated this
  branch intentionally; confirm before merging).

## Next step

- Unchecked PLAN items: sessionStorage persistence for the Sleeper player index
  (multi-MB JSON re-downloaded per 30-min cache window per tab); refresh curated
  coach profiles in `src/lib/nfl/coaches.ts` after 2026 offseason staff changes.
