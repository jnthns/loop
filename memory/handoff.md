# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

The app is built, deployed, and connected to the real league. Remaining work is
the P0 backlog items — mostly *verifying* things this sandbox cannot reach live
— plus the draft board (P1) before the 2026-08-14 startup.

## Last pass did (round 7)

- **Live Sleeper sync — draft order is now drawn.** Ran `npm run sync:sleeper`
  against the API; Sleeper reports **slot 4** for user `comebackedOnYou`
  (`draft_order["1355422066613948416"]: 4`, verified via
  `GET /draft/1355043174896136192`). `data/draft.json` updated:
  `myDraftSlot: 4`, `myPicks` 4/21/28/…/357 (30 snake picks). Trending
  counts refreshed. Player dump skipped (within 24h) — pool still 39 QB /
  288 players. News-match rate 70/194 (~36%).
- **Phase 12 pool-verify task ticked** in `specs/PLAN.md` — criteria met from
  the prior live refresh and reconfirmed this pass.

## Earlier context (round 5)

- **Answered "are we superflex?" and found a real bug while checking.** Yes —
  `QB` + `SUPERFLEX` across 12 teams. While confirming that, the committed
  player pool turned out to have only **8 quarterbacks**, mostly waiver churn,
  because `selectPlayers()` only kept rostered/trending players and pre-draft
  nobody is rostered anywhere. Fixed with a pre-draft branch pulling the top
  ~250 players by Sleeper's own `search_rank`, moved into
  `src/lib/sleeper/map.ts` (`selectPlayers`, `topRankedPlayers`) so it is
  pure and tested like the rest of that module.
- **Wrote two knowledge articles** under an explicit, stated-up-front sourcing
  split: time-sensitive player claims cite a `data/news.json` item by URL;
  general judgement cites references and is marked `confidence: medium`.
  - `roster-construction/superflex-positional-builds.md` — this league's own
    arithmetic and five named build archetypes. `confidence: high`.
  - `startup-drafts/2026-offseason-landscape.md` — eleven real, cited items
    from the 23–29 July archive, with an explicit cited-vs-judgement split.
    `confidence: medium`, `time-sensitive`, `asOf: 2026-07-29`.
- **Made staleness structural.** `asOf` added to the knowledge schema;
  `tests/knowledge.test.ts` fails the build once a `time-sensitive` article's
  `asOf` exceeds 45 days.
- Both articles linked from `DraftPanel` (hrefs built in `team.astro`, passed
  through `TeamApp`), so strategy is one click from the shortlist.
- `loops/knowledge-curator.md` and `skills/curate-knowledge/SKILL.md` now state
  the citation split explicitly rather than leaving it implicit.

## Earlier context

- **The visual-design overhaul is merged.** Nine-tone-family palette
  (`src/styles/global.css`), one assignment table (`src/lib/ui/tone.ts`),
  `.section-head` primitives, cards/chips/meters. `tests/tone.test.ts` freezes
  the contract. If you're adding UI, use `SectionHead`/`PosTag`/`Chip` from
  `src/components/ui/Primitives.tsx` — don't hard-code a color; set
  `data-tone`/`data-pos` and read `--tone*`.
- **The deploy chain is fixed and verified.** `GITHUB_TOKEN` pushes don't
  trigger workflows, so `pages.yml` chains off `refresh` via `workflow_run`,
  guarded on success — confirmed live (`refresh #4` → `pages #6` on the same
  SHA), not just configured.
- **The app is built for the pre-draft phase.** `data/draft.json` from
  Sleeper; `/team` leads with the draft + shortlist while the roster is
  empty; dashboard summarizes open slots instead of listing 26.
- **Tests never assert against `data/*.json`** — the sync rewrites those every
  six hours. Behavior tests use `tests/fixtures/league.ts`;
  `tests/data-coupling.test.ts` enforces the split so it cannot regress.

## Evidence (this pass)

- `npm run sync:sleeper` → slot 4, picks 4/21/28/…/357; `scripts/check.sh`
  green (437/437 tests).
- Sleeper API cross-check: `draft_order["1355422066613948416"] === 4`.
- Pool unchanged (player dump within 24h): 39 QB / 288 players; news-match
  70/194 (~36%).

## The league, as Sleeper reports it

**DyNastyNasty** · 12-team · superflex · 1 PPR · +0.5 TE premium.
Slots: QB, RB×2, WR×3, TE, FLEX×2, SUPERFLEX, BN×16 — no K, no D/ST, no taxi,
no IR. Roster is 0/26 filled — the startup draft has not happened. Startup is
**snake, 30 rounds, 2026-08-14**; **draft order drawn — you are slot 4**
(picks 4, 21, 28, 45…). Player pool is 288
players (39 QB / 90 RB / 117 WR / 42 TE), refreshed daily.

## Blockers / needs a human

1. **Confirm live picks once the draft starts** — order is set (slot 4);
   `picks[]` is still empty pre-draft. P0 in the backlog.
2. **Most synced players carry a `defaultTier()` guess and an empty note** —
   a placeholder judgement in the field where a real one goes, now across
   ~288 players rather than 56. P0 in the backlog.
3. **The independent checker still has not run.** `CHECKER_CMD` is unset, so
   nothing has adversarially graded any of this. P0 in the backlog.

## Constraints worth re-reading before coding

- **Never assert a pipeline works — watch it work.** Four real bugs in this
  project (CI running before `npm ci`, the deploy that never fired, the
  8-QB pool, and a green `refresh` that skipped the fix because of a 24h
  cache) were each shipped believing something that turned out false. Verify
  the end state from the committed data; don't trust the config, the design,
  or a green checkmark.
- **Never assert a time-sensitive player fact from memory.** Cite the
  `data/news.json` item by URL, check its `publishedAt`. General strategy may
  cite references instead — see the split stated in
  `loops/knowledge-curator.md`.
- **Tag `time-sensitive` and set `asOf`** on any article whose value depends
  on current news; `tests/knowledge.test.ts` fails it past 45 days old.
- **Never hard-code a color.** Set `data-tone`/`data-pos`, read `--tone*`.
  New facets need a row in `src/lib/ui/tone.ts`.
- **Ship to `main` directly.** No PRs, unless the platform running the pass
  requires one — then merging is the human's call. See
  `skills/ship-to-main/SKILL.md`.
- **Builds must never require network.** All fetching happens in `refresh.yml`.
- **The deploy is chained by `workflow_run`, not by the refresh's push.**
- **Behavior tests use `tests/fixtures/league.ts`**, never `data/*.json`.
- **No API keys anywhere** — Sleeper and ESPN are both keyless.
- `base: '/loop'` — internal links go through `src/lib/url.ts` or Pages 404s.
- **Discovered work goes to `specs/BACKLOG.md`,** and only reaches
  `specs/PLAN.md` once it has a named mechanical check.

## Next step

- The remaining P0s above (draft details, real tier/notes, independent
  checker), then the draft board (P1) — the shortlist is 8 players and the
  startup is 30 rounds two weeks out, and the pool is now big enough (288
  players) that a real tiered board is worth building against it.
