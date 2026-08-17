# Build Status Log

> Durable, append-only progress log. The loop greps this file for the sentinel
> `ALL TASKS DONE` to decide when the whole build is complete. Each pass appends
> an entry with **real evidence** (actual check output), never a claim. No secrets.

## Sentinel

The build is **not** done. When — and only when — every task in `specs/PLAN.md`
is checked and `scripts/check.sh` exits 0 and the checker approves, the maker
appends the exact line below (uncommented) at the end of this file:

<!-- ALL TASKS DONE -->

(The sentinel above is commented out on purpose so the loop does not stop early.
Remove the comment markers only when the build is truly finished.)

---

## Log

### Pass 0 — product pivot to dynasty fantasy football guide

- State: the previous product (an AI recipe generator) is retired. The loop
  harness is unchanged and remains the asset; only the app being built changed.
- Product: a dynasty fantasy football guide — RSS news panel on every page, a
  team page (roster + alternatives + editable budgets), and a knowledge base
  organized by facet that the loop grows over time.
- Decisions recorded in `specs/spec.md` §5: Astro 5 static on GitHub Pages
  (`base: '/loop'`), committed news snapshot refreshed by CI cron (builds never
  need network), committed `data/*.json` as source of truth, no runtime LLM and
  no API keys.
- Next: Phase 0 reset, then scaffold the Astro project.
- Evidence: `specs/spec.md` has no `TODO` markers; Phase 0 tasks enumerated in
  `specs/PLAN.md`.

### Pass 1 — reset + scaffold (commit `db98df8`)

- Retired the recipe product across `specs/`, `README.md`, `.env.example`, and
  `AGENTS.md`; replaced `docs/plan.md` with `docs/architecture.md`; deleted the
  `site/` placeholder.
- Scaffolded Astro 7 static + React islands + Tailwind v4 + strict TS + Vitest,
  `base: '/loop'`, links routed through `src/lib/url.ts`.
- Fixed a latent harness bug: `check.sh` probed for npm scripts with
  `process.exit(<boolean>)`, which throws on Node ≥ 22 — so the check had been
  **silently skipping typecheck, test, and build** for any Node project. This
  strengthens the gate; it does not weaken it.
- Evidence: `scripts/check.sh` → `npm run typecheck` 0 errors, `npm run test`
  8/8, `npm run build` 1 page, `check.sh passed.`

### Pass 2 — data layer, shell, news pipeline (commit `5daaab5`)

- Zod schemas + committed seed data + import-time validation; three-region shell
  with the news panel on every route; RSS/Atom fetch, normalize, merge, dedupe;
  `/news` archive; `.github/workflows/news.yml` on a six-hour cron.
- Evidence: `npx vitest run` → 80/80 passing.
  `npm run news:fetch -- --fixtures` → `Read 2/6 source(s), 6 item(s) in;
  5 retained (+5)` — the cross-posted story collapsed, proving dedupe offline.

### Pass 3 — team page, knowledge base, dashboard (commit `255dd88`)

- `/team`: slots grouped starters/bench/taxi/IR, position-eligible assignment,
  alternatives per slot, two budget ledgers, localStorage overlay + JSON export.
- `/knowledge`: nine facets, one seeded article each, sources required by both
  the collection schema and `tests/knowledge.test.ts`.
- `/`: roster × news cross-reference, alerted items held out of the digest,
  knowledge-gap nudges.
- Evidence: `npx vitest run` → 210/210 passing; `npm run build` → 22 pages.

### Pass 4 — loops, skill, docs

- Added `loops/news-refresh.md`, `loops/knowledge-curator.md`,
  `loops/roster-review.md`, and the `curate-knowledge` skill.
- Added `tests/insights.test.ts` so the roster-review loop's citation contract is
  enforced **before** it ever writes: a suggestion citing nothing, or citing a
  news id or article slug that does not exist, fails the build.
- Evidence: `scripts/check.sh` → typecheck 0 errors / 0 warnings, `vitest run`
  220/220, `astro build` 22 pages, `check.sh passed.` Built `dist/` uses
  `/loop/`-prefixed hrefs on every internal link (checked across the dashboard,
  team, facet index, and facet pages).

### Pass 5 — Sleeper, richer news, progress tracker, ship to main

- **Fixed red CI.** `verify.yml` and `pages.yml` both ran `scripts/check.sh`
  before any `npm ci`, so `astro check` exited 127 (`astro: not found`) on every
  Node commit — run 30426608107. Both now set up Node and install first; the
  dead `site/` fallback in `pages.yml` is gone so a missing `dist/` fails loudly.
- **Sleeper sync** (`scripts/sync-sleeper.ts`, keyless): resolves
  `comebackedOnYou` → league → roster. Sleeper owns format, roster, and FAAB;
  `targets[]`, per-slot notes, and the auction budget are preserved. A fetch
  failure writes nothing rather than blanking a good roster, and several
  candidate leagues stop the run for a human to choose.
- **ESPN's keyless JSON news API** added as a second source, merging through the
  existing dedupe. Its category list names athletes outright, which beats
  substring-matching prose.
- **Sleeper add/drop counts** land in `data/trending.json`, deliberately *not* in
  `data/news.json` — filing a count as news would mean inventing a headline and a
  URL. The dashboard labels it market signal, and a test asserts the section
  contains no links.
- **`refresh.yml`** replaces `news.yml`: sync → fetch → check → commit only what
  changed under `data/` → push to `main`, which triggers the deploy. Public repo,
  so Actions minutes are unlimited; ~10 Sleeper calls per run.
- **Progress tracker and backlog**: `specs/BACKLOG.md` with a promotion gate (no
  plan task without a named check), `npm run progress`, and a `/progress` route
  reading the same files the loop reads.
- **Ship-to-main rule**: `skills/ship-to-main/SKILL.md` plus `AGENTS.md` §6/§8.
  No PRs; the check and the checker are the gate.
- Evidence: `scripts/check.sh` → typecheck 0 errors, `vitest run` 299/299,
  `astro build` 23 pages, `check.sh passed.`
  `npm run sync:sleeper -- --fixtures` → 13/20 slots filled, 22 players retained,
  8 targets preserved, 1 satisfied target reported not deleted.
  `npm run news:fetch -- --fixtures` → 9 items in, 8 retained across RSS + Atom +
  ESPN JSON.

### Pass 6 — first live run, and the flaw it exposed

- `verify` and `pages` went **green on `main`** — the CI ordering fix works, and
  the site deployed for the first time.
- `refresh` ran against the **real Sleeper league** and went red. The sync itself
  worked: the rendered roster in the failure output shows the live league has
  **no taxi and no IR slots**, the hand-written auction budget survived intact,
  and the targets were preserved and reattached.
- The failure was mine: `tests/team-app.test.tsx`, `dashboard.test.tsx`,
  `cross-reference.test.ts`, `news-pipeline.test.ts`, and `espn-source.test.ts`
  all asserted against `data/team.json` / `data/players.json` — files the sync
  rewrites every six hours. That made an ordinary roster move fail the build:
  **a check that moves**, which is precisely what `AGENTS.md` §3.6 forbids.
- Fix: `tests/fixtures/league.ts` is a frozen league that behavior tests use.
  Only `schemas.test.ts` and `insights.test.ts` read the synced files, and they
  assert shape and referential integrity, never specific players.
  `tests/data-coupling.test.ts` enforces the split so it cannot regress.
- The fixture deliberately keeps TAXI and IR slots even though the live league
  has neither, so those code paths stay covered.
- Evidence: `scripts/check.sh` → typecheck 0 errors, 318 tests, 23 pages, passed.

### Pass 7 — the data was never reaching the site

- **Design error, mine, asserted without verifying.** Pass 5 claimed "a data
  refresh and a deploy are one pipeline". They were not. GitHub does not trigger
  workflows from pushes made with `GITHUB_TOKEN` (anti-recursion), so
  `refresh.yml`'s data commits never fired `pages.yml`. The live site sat on
  `296402e`, deployed 08:03 — *before* any data landed — while `main` carried
  235 news items, 56 players, and 50 trending rows nobody could see. The cron and
  the sync were both working perfectly; only the last hop was missing.
  Fix: `pages.yml` chains off `refresh` with a `workflow_run` trigger, guarded on
  a successful conclusion. `docs/architecture.md`, `specs/spec.md` §5, and
  `loops/news-refresh.md` all said the wrong thing and are corrected.
- **The app was built for the wrong phase.** The live roster is 0/26 filled
  because the startup draft has not happened. `/team` rendered 26 blank rows,
  which reads as a broken sync. Now: `data/draft.json` from Sleeper (status,
  type, schedule, your slot, and your pick numbers), a draft panel, an explicit
  "empty until the draft" notice, and the targets promoted to a draft shortlist.
  All keyed off `draft.status`, so it becomes a roster page on its own the moment
  picks are made.
- **Two bugs found by writing the tests, not by running the app:**
  - Target reattachment matched on position eligibility, so the live sync had
    silently moved the superflex QB targets onto QB1 (the real league names the
    slot `superflex-1`, the fixture `sflex-1`). Now matches slot kind first.
  - A target whose player is absent from the player file dangled on a
    nonexistent slot, which would fail referential integrity. Now falls back to
    the bench.
- Team name now comes from `/league/<id>/users` instead of being stuck on
  "My Team" forever.
- Evidence: `scripts/check.sh` → typecheck 0 errors, 366 tests, 23 pages, passed.
  `npm run sync:sleeper -- --fixtures` → `draft: pre_draft, snake, 26 rounds ·
  your slot 7 → picks 7, 18, 31, 42, 55` (snake arithmetic verified against a
  full 12-team draft in `tests/draft.test.ts`).

### Pass 8 — the chain verified, and the real draft

- **The `workflow_run` chain fires.** `refresh #4` committed `fe18577`, and
  `pages #6` started with event `workflow_run` on that exact SHA — the hop that
  had been silently missing since the refresh workflow was written. Verified by
  watching it, not by reading the YAML.
- **The real draft, from Sleeper:** `pre_draft`, **snake, 12 teams, 30 rounds**,
  scheduled **2026-08-14T15:00:29Z** — about two weeks out. The draft order is
  **not yet set**, so `myDraftSlot` is null and `myPicks` is empty; the app says
  "not set" rather than inventing a slot, which is the correct behavior and worth
  keeping when the order does land.
- Team name resolved to `comebackedOnYou` — the Sleeper display name, because no
  custom team name is set in the league. That is the documented fallback.
- Evidence: `data/draft.json` on `main` at `fe18577`; `pages #6` event
  `workflow_run`, head SHA `fe18577`.

#### What is NOT done

- **The independent checker has not run.** `CHECKER_CMD` is unset, so
  `scripts/verify.sh` would fall back to the mechanical check alone — explicitly
  a weaker gate. Per `specs/spec.md` §10 the build is not done until a separate
  checker approves, so the sentinel stays commented out.
- `data/news.json` and `data/trending.json` are empty, and `data/sleeper.json`
  still has null ids. This environment's egress proxy returns 403 on CONNECT for
  api.sleeper.app and the news hosts, so **every network path has been exercised
  only against committed fixtures**. The first real data arrives when
  `refresh.yml` runs in CI — and the live Sleeper league may contain slot kinds
  or settings the mapper skips, which is tracked as a P0 in `specs/BACKLOG.md`.
- Seed roster and player data are placeholders until that first sync lands (see
  `data/README.md`).

### Pass 9 — a color-coded visual system

- Request: the app was hard to parse — "more prominent section headers and
  general formatting improvements". It was accurate: every section header was the
  same 13px semibold line above the same hairline rule, alerts looked like news
  looked like the market, and one blue accent was the only color in the UI.
- **Tone palette.** Nine hue families (blue, violet, teal, green, amber, orange,
  rose, pink, slate) declared in `src/styles/global.css` for light and dark, read
  through `--tone` / `--tone-soft` / `--tone-line`. A component sets `data-tone`
  or `data-pos` and never names a color; `--color-tone*` exposes the same values
  as Tailwind utilities, so `bg-tone-soft` follows whatever tone is in scope.
- **One assignment table.** `src/lib/ui/tone.ts` maps routes, knowledge facets,
  and positions, so the coding is learnable: knowledge violet, roster green,
  market amber, alerts rose; QB rose, RB green, WR blue, TE amber.
- **Headers and formatting.** `.section-head` (18px title, tone bar, count badge
  beside the heading, note underneath) shared through
  `src/components/ui/Primitives.tsx`; a gradient page hero with an eyebrow;
  rounded shadowed cards with a tone top edge and hover lift; chips, position
  tags, gradient meters, count bars behind market rows; richer article
  typography.
- Accessible names were preserved deliberately: count badges sit beside headings
  rather than inside them, and the `→` on section links is `aria-hidden`. Every
  `data-testid`, section id, ARIA label, and link target is unchanged — which is
  why the existing suites are the evidence that this was a restyle and not a
  rewrite.
- Evidence: `scripts/check.sh` passed — `astro check` 0 errors over 60 files,
  **373 tests in 19 files** (up from 366, with 6 new in `tests/tone.test.ts` and one more phase case in the plan parser),
  23 pages built. Verified visually, not just mechanically: the built site was
  served and screenshotted headless at 1500px and 430px wide, light and dark —
  dashboard, team, knowledge, news, progress, and an article. The first pass of
  those screenshots is what caught two facet marks rendering the same "RO".

#### What is NOT done

- The independent checker still has not run (`CHECKER_CMD` unset) — unchanged,
  and still the reason the sentinel stays commented out.
- This work is on `cursor/visual-design-overhaul-f688` with a PR open rather than
  pushed straight to `main`, because the run's platform requires a branch and PR.
  `AGENTS.md` §6 says ship direct to `main`; the merge is the human's call here.

### Pass 10 — the player pool bug, and content for the format it exposed

- **Answered "are we superflex?" and found a real bug doing it.** Yes: `QB` +
  `SUPERFLEX` across 12 teams, up to 24 startable quarterbacks. While
  confirming that from `data/team.json`, checking the committed player pool
  turned up only **8 quarterbacks**, mostly waiver churn — in the one format
  where QB is the defining asset. Cause: `selectPlayers()` only kept players
  rostered somewhere in the league or trending, and pre-draft nobody is
  rostered anywhere, so the pool collapsed to whatever the waiver wire
  happened to be talking about. Same cause left 131/147 news items matching
  no known player, which made the roster-alert feature inert.
- **Fix:** `selectPlayers()` and a new `topRankedPlayers()` moved from
  `scripts/sync-sleeper.ts` into `src/lib/sleeper/map.ts` (pure, tested,
  matching the rest of that module) and gained a pre-draft branch — when no
  roster anywhere has a player, pull the top ~250 by Sleeper's own
  `search_rank`, filtered to active QB/RB/WR/TE. Post-draft this branch does
  not fire; verified by a dedicated regression test.
- **Two knowledge articles**, written under an explicit sourcing split stated
  up front rather than assumed: time-sensitive player claims cite a
  `data/news.json` item by URL; general judgement cites reference sources and
  is marked `confidence: medium`, never asserted as settled fact.
  - `roster-construction/superflex-positional-builds.md` — this league's own
    arithmetic (24 startable QBs, 3 flex-eligible slots, a 30-round snake) and
    five named build archetypes with their failure conditions.
    `confidence: high`.
  - `startup-drafts/2026-offseason-landscape.md` — eleven real, cited items
    from the 23–29 July news archive (Cousins named Raiders QB1, the
    Murray/McCarthy Vikings battle, Mahomes' return, Dell's clearance,
    Nabers' PUP status, Tyreek Hill's injury update, rookie usage notes),
    with an explicit "what's cited vs what's judgement" section.
    `confidence: medium`, tagged `time-sensitive`, `asOf: 2026-07-29`.
- **Staleness became structural, not a promise.** `asOf` added to the content
  schema; `tests/knowledge.test.ts` now fails the build if a `time-sensitive`
  article's `asOf` is more than 45 days old — a dated draft article silently
  rotting into next season would otherwise be worse than no article at all.
- Both articles are linked directly from `DraftPanel` (base-path-aware hrefs
  built in `team.astro`, threaded through `TeamApp`), so the strategy is one
  click from the pre-draft shortlist rather than buried under `/knowledge`.
- `loops/knowledge-curator.md` and `skills/curate-knowledge/SKILL.md` now
  state the citation split explicitly — which kind of claim needs which kind
  of source — rather than leaving "no uncited claims" to be interpreted.
- Evidence: `scripts/check.sh` → typecheck 0 errors, **405 tests**, 25 pages,
  passed. `npx tsx scripts/sync-sleeper.ts --fixtures` unaffected (post-draft
  branch does not fire against the existing fixture). New pre-draft-branch
  unit tests pass against a synthetic ranked pool.

#### What is NOT done

- Draft order is still unset in the live league (confirmed via the last live
  sync: `myDraftSlot: null`), so the slot-to-picks path remains fixture-tested
  only until Sleeper assigns one.
- The independent checker still has not run — unchanged.

### Pass 11 — verifying the pool fix live, and a second bug it exposed

- Pushed Pass 10 to `main` (`643bf7e`) and dispatched `refresh`. It completed
  successfully but **did not exercise the fix**: `data/players.json` stayed
  at 8 QB / 56 players, unchanged byte-for-byte in the diff. Reading the job
  log (not just the green checkmark) showed why —
  `· player dump: skipped (synced within 24h)`. The 5MB Sleeper player dump
  is intentionally throttled to once per 24h; the last fetch (`2026-07-29
  08:03Z`) predated the fix, and the sync fetches nothing on a throttled run
  (`players = {}`), so `selectPlayers()` in `scripts/sync-sleeper.ts` took the
  `Object.keys(snapshot.players).length > 0 ? selectPlayers(...) : previousPlayers`
  branch straight to `previousPlayers` — the stale 8-QB list. A fix can ship
  clean, the pipeline can go green, and still never have actually run once,
  if something upstream is cached. This is the same lesson as the two
  earlier pipeline bugs, from a new angle.
- Back-dated `lastPlayerSync` in `data/sleeper.json` to force a fresh dump,
  pushed (`84736fc`), and dispatched `refresh` again. This run fetched the
  full dump and the fix fired.
- **Confirmed from the committed data, not from log lines:**
  `data/players.json` went from **8 QB / 56 players** to **39 QB / 288
  players** (117 WR, 90 RB, 42 TE), every one carrying `rank`. The
  news-match rate (news items whose title/summary names a known player) rose
  from 16/147 (~11%) to **68/186 (~37%)** — both well above the bar set in
  the backlog item this closes.
- Removed the now-shipped "verify the pre-draft pool" item from
  `specs/BACKLOG.md` per that file's own convention (the record lives here,
  not there).
- **What is NOT done:** draft order still unset (`myDraftSlot: null`); the
  independent checker still has not run; the 24h player-dump throttle means
  the pool composition will drift only once a day even as camp news breaks —
  worth knowing, not necessarily worth changing before the startup.

### Pass 12 — live Sleeper sync, draft order drawn (2026-07-30)

- Ran `npm run sync:sleeper` against the live API. Sleeper now reports draft
  order: user `1355422066613948416` is **slot 4** (verified via
  `GET /draft/1355043174896136192` → `draft_order[...] === 4`).
- `data/draft.json` updated: `myDraftSlot: 4`, `myPicks`
  `[4, 21, 28, 45, …, 357]` (30 snake picks). `data/trending.json` refreshed.
  Player dump skipped (within 24h) — pool unchanged at 39 QB / 288 players;
  news-match 70/194 (~36%).
- Phase 12 pool-verify task ticked in `specs/PLAN.md`. Backlog draft-order
  item narrowed to "confirm live picks once the draft starts."
- Evidence: `scripts/check.sh` → typecheck 0 errors, vitest 437/437, build
  26 pages, `check.sh passed.`

### Pass 13 — `/builds`: expert-backed archetypes and pick targets

- **What:** a new `/builds` page that ranks seven startup build archetypes for
  this league's actual format and draft slot, then produces targets across all
  30 owned picks. Delivered as eight bounded commits (`da1ca97`..`2e18f2e`).
- **Data:** new `scripts/sync-market.ts` pulls DynastyProcess's free, keyless
  CSVs — FantasyPros expert consensus rankings and KeepTradeCut-derived trade
  values, in the `_2qb` superflex columns that match this league — and commits
  `data/market.json`. The join is `fp_id → fantasypros_id → sleeper_id`, an
  exact id lookup: 646/646 rows, 0 unmatched, 98.3% Sleeper coverage. Write
  floors (400 players, 40 picks, 60% match rate) verified by forcing a breach:
  exit 1, snapshot byte-identical. Zero new secrets; the no-network build
  guarantee holds.
- **Measured fact the model rests on:** mean `valueSf/value1qb` is **2.96**
  across the top 24 QBs against **0.78** for WRs. The superflex QB premium is
  the largest effect in the data, and the scoring lets it dominate rather than
  asserting it.
- **Three modelling bugs found by checking output against the real board, not
  by the tests** (all now have regression tests):
  1. `formatFit` normalized by the largest position weight, rewarding breadth —
     a flat "want everything" profile scored the maximum and beat every sharp
     thesis. Now a cosine against the format's slot shares.
  2. `ageBias` was declared and never read, so youth-first and win-now —
     deliberate opposites — tied and both surfaced as top pick at once.
  3. `need` had minimums but no saturation or format floor: the sheet returned
     seven QBs in eight picks, while archetypes not naming QB drafted none at
     all across 30 rounds — rosters that cannot legally start in superflex.
- **Citations:** 13 traced to `data/news.json` (CI-harvested from live RSS), 8
  to stable index pages, **0 fabricated**, labels checked against article
  titles. This was audited mechanically because egress policy blocks every
  external host, so a hallucinated URL could not be caught by fetching it.
- **Evidence:** `scripts/check.sh` → typecheck 0 errors, vitest 552/552 across
  31 files, build 26 pages, `check.sh passed.` `dist/builds/index.html` renders
  all 30 owned pick numbers matching `data/draft.json`.
- **Known limits:** per-player deep-link templates (Sleeper/KTC/FantasyPros/
  ESPN) are unverified — no host is reachable from CI's sandbox — and are kept
  in one table in `src/lib/market/dynastyprocess.ts` for a single-point fix.
  The page serializes all seven plans (1.1 MB, 136 KB gzipped).

### Pass 14 — `/picks`, position boards from real popularity data

- **Shipped:** a `/picks` page comprised of one list per position (QB/RB/WR/TE),
  each ordered by popularity, for the two moments that need it — a target going
  off the board mid-draft, and waiver-wire Tuesday in season.
- **Two popularity measures, deliberately not merged:**
  - *Draft board* — FantasyPros Expert Consensus Rank via `data/market.json`,
    read from the superflex sheet because this league is superflex. Switching
    the format flag flips the QB order, which is asserted rather than assumed.
  - *Waiver trending* — Sleeper add counts over the last 24h from
    `data/trending.json`, the raw behavior of every Sleeper manager.
- **Availability is real, not inferred:** `drafted` comes from
  `data/draft.json` picks (id, falling back to name+pos, which is all the draft
  feed gives for an unknown player), `rostered` from `rosteredInLeague`, written
  by the Sleeper sync off actual league rosters. A row with no market match
  renders `null`, never a guessed rank.
- **Verified against the real board, not only the tests** (`npx tsx` probe over
  the committed data): QB board opens Allen → Lamar → Mahomes; WR opens Chase →
  JSN → Jefferson; TE opens Bowers → McBride; trending WR is led by Barion Brown
  at 48,411 adds. All match the source files.
- **Evidence:** `scripts/check.sh` → typecheck 0 errors, vitest **620/620**
  across 36 files, build 27 pages (`/picks/index.html` among them),
  `check.sh passed.`
- **Known limit:** Sleeper's trending endpoint returns ~25 players total, so the
  QB and TE trending lists are 2 rows deep in the offseason. That is the source's
  depth, not a bug; the lists fill out in season.

### Pass 15 — sidebar live Sleeper roster refresh

- **Shipped:** a **Refresh from Sleeper** control in the left rail (compact
  "Sleeper" on the mobile top bar). Hits the keyless Sleeper API for league,
  rosters, and draft picks — deliberately skips the ~5MB player dump — and
  merges through the existing pure mappers into a browser-only snapshot.
- **Why localStorage, not a write to `data/`:** the deploy is static GitHub
  Pages; a client button cannot commit. Same contract as the team edit overlay:
  live until you export / run `sync:sleeper`.
- **Team page wiring:** `TeamApp` prefers the live snapshot over the edit
  overlay, updates draft + rostered flags, and stubs just-drafted players from
  pick metadata when they are not yet in the committed pool.
- **Evidence:** `npm run typecheck` → 0 errors; `npm run test` → **647/647**
  (38 files); `npm run build` → 28 pages. New coverage in
  `tests/sleeper-live-refresh.test.tsx` + shell asserts the button mounts.

### Pass 16 — roster health panel replaces draft schedule and shortlist

- **Removed from `/team`:** the pick schedule (`DraftPanel`) and the draft
  shortlist. Slot-level alternatives remain in the roster table.
- **Added:** a 2026 roster-health audit (`src/lib/team/health.ts`) that scores
  eight facets — QB room (superflex), RB age cliff, WR ballast, TE premium,
  age stagger, floor vs ceiling, injuries, bench insurance — then maps the
  four positional rooms onto Roto Street Journal's 0–40 contend / pivot /
  rebuild bands.
- **Sources (web + YouTube), cited in the panel:** RSJ peak-age audit (Jul
  2026), DLF/FFPC format construction, FantasyPros 2026 SF mock, PlayerProfiler
  RB cliff, Dynasty Nerds rebuild windows, ETR 2026 staff mock, Dynasty
  Ballers RB-depth episode, Smash Except S-tier building blocks, plus this
  guide's age-curves article. Player quality is only the stored `tier` / `age`
  / injury fields — no invented rankings.
- **Evidence:** `npm run typecheck` → 0 errors; `npm run test` → **652/652**;
  `npm run build` → 28 pages. Coverage in `tests/roster-health.test.tsx`.

