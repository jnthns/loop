# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

The app is built and connected to the real league. Remaining work is verifying
the first live data pull and whatever `specs/BACKLOG.md` promotes next.

## Last pass did (round 4)

- **Gave the app a color-coded visual system.** It read as one long gray column.
  Now: nine tone families in `src/styles/global.css` (light + dark) consumed via
  `--tone` / `--tone-soft` / `--tone-line`; one assignment table in
  `src/lib/ui/tone.ts` (tone per route and facet, fixed hue per position);
  `.section-head` with an 18px title, tone bar and count badge; a gradient page
  hero; cards, chips, position tags and meters instead of hairline rules.
- Shared primitives live in `src/components/ui/Primitives.tsx` — use
  `SectionHead`, `PosTag`, `Chip`, `EmptyState` rather than re-inventing them.
- `tests/tone.test.ts` freezes the contract (every tone declared in both schemes,
  every facet a distinct tone, every position a hue).
- On branch `cursor/visual-design-overhaul-f688` with a PR open, not on `main` —
  the platform running this pass required a branch. Merging is the human's call.

## Previously (round 3)

- **Fixed the deploy chain.** `GITHUB_TOKEN` pushes do not trigger workflows, so
  `refresh`'s data commits never fired `pages`. The live site had been stuck on
  pre-data `296402e` while `main` carried 235 real news items. `pages.yml` now
  chains off `refresh` via `workflow_run`, guarded on success.
- **Built for the pre-draft phase.** `data/draft.json` from Sleeper; `/team`
  leads with the draft + shortlist while the roster is empty; the dashboard
  summarizes 26 open slots instead of listing them.
- Fixed target reattachment (slot kind first) and the dangling-target case;
  team name now comes from `/league/<id>/users`.

## Earlier

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

- `scripts/check.sh`: typecheck 0 errors, 373 tests in 19 files, 23 pages, passed.
- The restyle was checked by eye as well as mechanically: `dist/` served locally
  and screenshotted with headless Chrome at 1500px and 430px, light and dark.
- `verify` #7 and `pages` #3 green on `main` (commit `6d326b0`).
- The first live `refresh` proved the sync works: it read the real league, which
  has **no taxi and no IR slots**, and preserved the auction budget and targets.

## The league, as Sleeper reports it

**DyNastyNasty** · 12-team · superflex · 1 PPR · +0.5 TE premium.
Slots: QB, RB×2, WR×3, TE, FLEX×2, SUPERFLEX, BN×16 — **no K, no D/ST, no taxi,
no IR**. Roster is **0/26 filled: the startup draft has not happened**, confirmed
by the owner. That is why `/team` leads with the draft rather than the roster.

## Blockers / needs a human

1. **Confirm the draft data against the Sleeper app** once the next sync
   populates `data/draft.json` — date, type, and your slot. The mapping is proven
   only against fixtures. P0 in `specs/BACKLOG.md`.
2. **48 of 56 synced players carry a `defaultTier()` guess and an empty note.**
   That is a placeholder judgement sitting in the field where a real one goes.
   P0 in the backlog.
3. **The independent checker still has not run.** `CHECKER_CMD` is unset, so
   nothing has adversarially graded any of this. P0 in the backlog.

## Constraints worth re-reading before coding

- **Never hard-code a color.** Set `data-tone` (or `data-pos`) and read
  `--tone*` / the `tone` Tailwind colors. New facets need a row in
  `src/lib/ui/tone.ts` or `tests/tone.test.ts` fails.
- **Keep count badges and decorative arrows out of accessible names.** The test
  suite queries headings and links by name; putting a count inside an `h2` breaks
  it, which is exactly how the first attempt at this went red.
- **Ship to `main` directly.** No PRs. See `skills/ship-to-main/SKILL.md`.
- **Builds must never require network.** All fetching happens in `refresh.yml`.
- **The deploy is chained by `workflow_run`, not by the refresh's push.** Pushes
  made with `GITHUB_TOKEN` do not trigger workflows. If the site is ever stale
  while `main` has fresh data, check that trigger first.
- **Never assert a pipeline works — watch it work.** Both of this project's real
  bugs (CI running before `npm ci`, and the deploy that never fired) were claimed
  as done and shipped red. Verify the end state, not the config.
- **Behavior tests use `tests/fixtures/league.ts`**, never `data/*.json` — the
  sync rewrites those every six hours. `tests/data-coupling.test.ts` enforces it.
- **No API keys anywhere** — Sleeper and ESPN are both keyless.
- `base: '/loop'` — internal links go through `src/lib/url.ts` or Pages 404s.
- **No uncited claims**, and no fabricated data: counts are not news, and the
  sync writes nothing on failure rather than guessing.
- **Discovered work goes to `specs/BACKLOG.md`,** and only reaches
  `specs/PLAN.md` once it has a named mechanical check.

## Next step

- Merge `cursor/visual-design-overhaul-f688` so `pages` deploys the new design,
  then confirm the deploy landed rather than assuming it.
- Then the P0s above, then the draft board (P1) — the shortlist holds 8 players
  and a startup is 26 rounds, so the board is what you would actually want open
  on draft night.
