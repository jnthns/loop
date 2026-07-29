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

#### What is NOT done

- **The independent checker has not run.** `CHECKER_CMD` is unset, so
  `scripts/verify.sh` would fall back to the mechanical check alone — explicitly
  a weaker gate. Per `specs/spec.md` §10 the build is not done until a separate
  checker approves, so the sentinel stays commented out.
- `data/news.json` is empty. This environment's egress proxy returns 403 on
  CONNECT for the feed hosts, so the pipeline has only been exercised against
  fixtures. The first real snapshot arrives when `news.yml` runs in CI.
- Seed roster and player data are placeholders (see `data/README.md`).
