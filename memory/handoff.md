# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

The dynasty fantasy football guide in `specs/spec.md` is built. Remaining work is
verification and real data, not features.

## Last pass did

- Added the three app loops (`news-refresh`, `knowledge-curator`,
  `roster-review`), the `curate-knowledge` skill, and `tests/insights.test.ts`
  so the roster-review citation contract is enforced before that loop ever runs.

## Evidence

- `scripts/check.sh`: typecheck 0 errors, `vitest run` 220/220, `astro build`
  22 pages, `check.sh passed.`
- `npm run news:fetch -- --fixtures`: 6 items in, 5 retained — dedupe verified
  offline.
- `dist/` internal links are all `/loop/`-prefixed.

## Blockers / needs a human

1. **The independent checker has not run.** `CHECKER_CMD` is unset. Until a
   separate agent grades this work, the build is not done by the repo's own
   definition and `ALL TASKS DONE` stays commented out in `specs/STATUS.md`.
   Run `CHECKER_CMD="<agent> -p" scripts/verify.sh`.
2. **No real news yet.** This environment's proxy blocks the feed hosts (403 on
   CONNECT), so `data/news.json` is empty and the pipeline has only run against
   fixtures. Trigger the `news` workflow (`workflow_dispatch`) once in CI to get
   the first real snapshot; that push also redeploys Pages.
3. **Seed data is placeholder.** `data/team.json` assumes a 12-team superflex,
   1 PPR, +0.5 TE-premium league, and `data/players.json` carries ages as of
   2026 / teams as of 2025. Replacing these with the real league is the highest
   -value human edit in the repo — every suggestion keys off them. See
   `data/README.md`.
4. **This work is on `claude/repo-purpose-clarification-qrpg37`, not `main`.**
   `AGENTS.md` §6 says deploy from `main`; merging is a human decision.

## Constraints worth re-reading before coding

- **Builds must never require network.** The news fetch is a separate CI job.
- **No API keys anywhere.** The site is static and calls nothing at runtime.
- `base: '/loop'` — internal links go through `src/lib/url.ts` or Pages 404s.
- **No uncited claims.** Knowledge articles need `sources[]`; insights
  suggestions need a resolving `newsRefs`/`knowledgeRefs`. Both are tested.

## Next step

- Run the independent checker, then tick the last item in `specs/PLAN.md` and
  append the sentinel — or fix whatever it rejects.
- Then merge to `main` and dispatch the `news` workflow.
