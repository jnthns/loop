# Implementation Plan — ordered task checklist

> The `maker` executes the **single highest-priority unchecked** item per pass.
> Top of the list = do next. Keep tasks small, reversible, and independently
> verifiable. Every task must name its check.

Legend: `- [ ]` not done · `- [x]` done · each task ends with `(check: ...)`.

---

## Phase 0 — Reset to the dynasty app

- [x] Rewrite `specs/spec.md` for the dynasty fantasy football guide.
      (check: §6 acceptance table present; no `TODO` markers)
- [x] Rewrite `specs/PLAN.md`, `specs/STATUS.md`, `memory/handoff.md`; replace
      `docs/plan.md` with `docs/architecture.md`. (check: prior-product
      references survive only as history in `STATUS.md`/`handoff.md`)
- [x] Strip `GEMINI_API_KEY` from `.env.example` and the Gemini guardrail line
      from `AGENTS.md`; rewrite the app sections of `README.md`; delete the
      `site/` placeholder. (check: no `GEMINI_API_KEY` in the tree)

## Phase 1 — Scaffold

- [x] Scaffold Astro 7 (static, `base: '/loop'`) with `@astrojs/react`, Tailwind
      v4, TypeScript strict, Vitest. (check: `npm run build` exits 0; `url.ts`
      base-path tests pass)
- [x] Add `typecheck`, `test`, `build` npm scripts so `scripts/check.sh` picks
      them up. (check: `scripts/check.sh` exits 0)
- [x] Fix the latent `has_script` bug in `scripts/check.sh` — `process.exit()`
      rejects booleans on Node ≥ 22, so the check silently skipped every npm
      script. (check: `check.sh` now runs typecheck/test/build)
- [x] Retire the `site/` placeholder now that `dist/` is the deploy artifact.
      (check: `pages.yml` build step resolves `path=dist`)

## Phase 2 — Data layer

- [x] Add Zod schemas in `src/lib/schemas/` for feeds, news, players, team,
      insights. (check: unit test per schema — valid parses, invalid throws)
- [x] Add seed `data/feeds.json`, `data/players.json`, `data/team.json`,
      empty `data/news.json` and `data/insights.json`. (check: schema tests
      validate every committed data file)
- [x] Add typed data loaders in `src/lib/data/` that parse at import time.
      (check: unit test — a malformed fixture throws with a useful message)
- [x] Configure the `knowledge` content collection with the frontmatter contract
      and the fixed facet list in `src/lib/knowledge/facets.ts`. (check:
      collection schema test; unknown facet rejected)

## Phase 3 — App shell

- [x] Build `BaseLayout.astro`: nav rail + main column + right news panel,
      dark-mode-aware tokens, dense typographic scale. (check: build passes;
      layout test asserts all three regions)
- [x] Build `NewsPanel` island rendering newest items with source + relative
      time. (check: component test renders N items, newest first)
- [x] Make the panel a drawer below `lg` with a toggle. (check: component test
      on open/close state)

## Phase 4 — News pipeline

- [x] Add `scripts/fetch-news.ts` with `fast-xml-parser`: RSS + Atom → normalized
      items, stable id from canonical URL. (check: unit tests over
      `tests/fixtures/espn-nfl.xml` (RSS) and `reddit-dynastyff.xml` (Atom), offline)
- [x] Add merge/dedupe + retention cap in `src/lib/news/merge.ts`. (check: unit
      test — same fixture twice yields no duplicate ids; cap enforced)
- [x] Add `--fixtures` offline mode and `npm run news:fetch`. (check: running it
      offline parses and validates without network. `--fixtures` implies
      `--dry-run` — fixture headlines are invented, and committing them would put
      fake news in front of a reader.)
- [x] Build `/news` archive with source/tag/team filters. (check: component test
      filters narrow the list)
- [x] Add `.github/workflows/news.yml` — cron + `workflow_dispatch`, commit only
      on change. (check: `workflow_dispatch` present; commit step guarded by
      `git diff --quiet`)

## Phase 5 — Team page

- [x] Build roster view grouped by slot from `data/team.json`. (check: component
      test — one row per slot, starters/bench grouped)
- [x] Build the alternatives/targets list per slot with rationale + priority.
      (check: component test — targets render under their slot)
- [x] Build editable budget ledgers (auction + FAAB) with
      `remaining = total − allocated`. (check: unit test on the math; component
      test on edit)
- [x] Add the localStorage overlay + JSON export. (check: round-trip test parses
      against `TeamSchema`)

## Phase 6 — Knowledge base

- [x] Build `/knowledge` facet index with article counts and last-updated.
      (check: route test lists all facets)
- [x] Build `/knowledge/[facet]` and `/knowledge/[facet]/[slug]` with sources,
      confidence, and updated date. (check: route test — facet page lists only
      its own articles)
- [x] Add the ≥1-source content test. (check: a sourceless fixture article fails
      the test)
- [x] Seed one substantive article per facet. (check: every facet has ≥1 article;
      facet index shows no empty facets)

## Phase 7 — Dashboard

- [x] Add the roster × news cross-reference selector in
      `src/lib/insights/cross-reference.ts`. (check: unit test — fixture news
      mentioning a rostered player is flagged, others are not)
- [x] Build `/` dashboard: latest digest, roster alerts, stale-knowledge nudges.
      (check: component test renders all three sections)

## Phase 8 — Loops, skills, ship

- [x] Add `loops/news-refresh.md`, `loops/knowledge-curator.md`,
      `loops/roster-review.md` per `loops/_template.md`. (check: each names all
      five parts and a mechanical check)
- [x] Add the citation-resolution test the `roster-review` loop promises, so its
      contract is enforced before it ever writes. (check: `tests/insights.test.ts`
      — dangling news/knowledge refs fail)
- [x] Add the `curate-knowledge` skill in `skills/`. (check: `SKILL.md` follows
      the existing skill format, frontmatter included)
- [x] Update `README.md`, `loops/README.md`, `skills/README.md`, and `docs/` for
      the dynasty app + new loops. (check: no dead relative links)
- [ ] Final green pass: `scripts/check.sh` exits 0 **and an independent checker
      approves**, then append `ALL TASKS DONE` to `specs/STATUS.md`. (check:
      sentinel present). Blocked on the checker only — see `specs/STATUS.md`
      Pass 4: the mechanical check is green, but `CHECKER_CMD` is unset, so no
      independent agent has graded this work. Run
      `CHECKER_CMD="<agent> -p" scripts/verify.sh` before ticking this.

## Phase 9 — Connect it to reality

- [x] Fix CI: `verify.yml` and `pages.yml` ran `scripts/check.sh` before any
      `npm ci`, so `astro check` exited 127 on every Node commit. (check: both
      workflows green on a push)
- [x] Build the Sleeper sync — `data/sleeper.json` config, keyless client, pure
      mappers, `scripts/sync-sleeper.ts`. Sleeper owns roster/format/FAAB;
      targets, notes, and the auction budget are preserved. (check:
      `tests/sleeper-map.test.ts` asserts targets and auction budget survive)
- [x] Add ESPN's keyless JSON news API as a second source, merging through the
      same dedupe. (check: `tests/espn-source.test.ts`, offline)
- [x] Capture Sleeper add/drop counts as market signal in `data/trending.json` —
      deliberately NOT as news, since inventing a headline and URL for a count
      would be fabrication. (check: dashboard test asserts no links in the market
      section)
- [x] Replace `news.yml` with `refresh.yml`: sync Sleeper, fetch news, run the
      check, commit only what changed, push to `main`. (check: cron +
      `workflow_dispatch` present; commit guarded by `git diff --quiet`)
- [x] Add `specs/BACKLOG.md`, `scripts/progress.sh`, and the `/progress` route.
      (check: `tests/progress.test.ts` agrees with a raw checkbox count, and
      every backlog item names a check)
- [x] Add the ship-to-main rule as a skill and in `AGENTS.md`. (check: no PR
      step remains in the documented workflow)
- [x] Decouple the tests from the synced data files. The first live sync turned
      CI red (run 30433592381) because component tests asserted against
      `data/team.json`, which the sync rewrites — a check that moves.
      (check: `tests/data-coupling.test.ts` fails if any behavior test imports a
      synced data file)
- [x] Verify the first live refresh in CI. (check: `refresh.yml` green on `main`;
      `data/news.json` holds 235 real items and `data/team.json` the real league)

## Phase 10 — Make the data reach the site, and build for a pre-draft league

- [x] Fix the deploy chain. `GITHUB_TOKEN` pushes do not trigger workflows, so
      `refresh`'s data commits never fired `pages` and the live site sat on
      pre-data `296402e` for six hours. `pages.yml` now chains off `refresh` with
      a `workflow_run` trigger guarded on success. (check: a `pages` run appears
      with event `workflow_run` and the deployment SHA advances)
- [x] Pull the draft from Sleeper into `data/draft.json` — status, type,
      schedule, your slot, your pick numbers. (check: `tests/draft.test.ts`,
      including snake pick numbers covering a full 12-team draft with no repeats)
- [x] Lead `/team` with the draft and a shortlist while the roster is empty, and
      say plainly that empty is expected. (check: `tests/pre-draft.test.tsx` —
      no slot rows pre-draft, all of them once players exist)
- [x] Summarize open slots on the dashboard instead of listing 26. (check:
      dashboard test asserts the summary replaces the list only when empty)
- [x] Take the team name from `/league/<id>/users`. (check: `teamNameFor` unit
      tests, including the blank-team-name fallback)
- [x] Reattach targets by slot kind, not just position eligibility — the live
      sync had silently moved superflex targets onto QB1. (check: regression test
      asserts they land on the SUPERFLEX slot)
- [x] Confirm the deploy fix live. (check: `refresh #4` committed `fe18577` and
      `pages #6` started with event `workflow_run` on that SHA — the missing hop,
      verified by watching it rather than by reading the YAML)

## Phase 11 — Make it readable

- [x] Give the app a color-coded visual system: a nine-family tone palette in
      `src/styles/global.css` consumed through `--tone*`, one assignment table in
      `src/lib/ui/tone.ts` (a tone per route and facet, a fixed hue per
      position), prominent `.section-head` headers, a gradient page hero, and
      cards/chips/meters in place of hairline rules. (check: `tests/tone.test.ts`
      — every tone declared light and dark, every facet mapped to a distinct one,
      every position given a hue; plus the existing role/name/testid suites still
      green, which is what proves the restyle kept the semantics)

## Phase 12 — Fix the player pool; write draft content for this format

- [x] Fix `selectPlayers()`: pre-draft, nobody is rostered anywhere in the
      league, so the pool collapsed to 8 QBs of waiver churn in a superflex
      format. Move `selectPlayers`/`topRankedPlayers` into
      `src/lib/sleeper/map.ts` (pure, tested) with a pre-draft branch pulling
      the top ~250 players by Sleeper's `search_rank`. (check:
      `tests/sleeper-map.test.ts` — pre-draft branch pulls ranked QBs, the
      branch does not fire once the league has actually drafted)
- [x] Add `asOf` to the knowledge schema and a staleness check for articles
      tagged `time-sensitive`. (check: `tests/knowledge.test.ts` fails an
      article whose `asOf` exceeds 45 days)
- [x] Write `roster-construction/superflex-positional-builds.md` — this
      league's arithmetic (24 startable QBs, 3 flex-eligible slots, 30-round
      snake) and five named build archetypes with failure conditions.
      `confidence: high`. (check: passes the source + facet tests)
- [x] Write `startup-drafts/2026-offseason-landscape.md` — every player claim
      cited to a `data/news.json` item by URL, with an explicit
      cited-vs-judgement split. `confidence: medium`,
      tagged `time-sensitive`, `asOf: 2026-07-29`. (check: passes the source,
      facet, and staleness tests)
- [x] Link both articles from `DraftPanel` via base-path-aware hrefs built in
      `team.astro`. (check: `tests/pre-draft.test.tsx` — links render with the
      right hrefs when supplied, omitted when not)
- [x] State the citation split explicitly in `loops/knowledge-curator.md` and
      `skills/curate-knowledge/SKILL.md` — time-sensitive player claims cite a
      news item; general claims may cite references; never assert a
      transaction or depth chart from memory. (check: both files name the
      split and the `asOf`/`time-sensitive` convention)
- [ ] Verify the pool fix against a live sync. (check: after a live `refresh`,
      `data/players.json` has QBs in the dozens and the share of `data/news.json`
      items matching a known player is well above 16/147)

---

<!--
When every box above is checked and `scripts/check.sh` is green, the maker writes
"ALL TASKS DONE" to specs/STATUS.md. Discovered work becomes NEW unchecked items
here — do not silently expand an in-progress task.
-->
