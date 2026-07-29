# Loop: news-refresh

Keeps the committed news snapshot current. This is the loop the whole app sits
on: nothing else in the repo touches the network, so if this stops, the guide
quietly goes stale while still looking fine.

## Contract

- **End state (done means):** `data/news.json` contains every item the enabled
  feeds published since the last run, deduped, schema-valid, and committed.
- **Evidence required:** `npm run news:fetch` exits 0; `scripts/check.sh` exits 0;
  `git diff --stat` touches `data/news.json` and nothing else.
- **Constraints (must hold):** only `data/news.json` changes. Never hand-write a
  news item. Never commit fixture-derived items (`--fixtures` implies
  `--dry-run` for exactly this reason). Never disable a feed to make a run green
  — a failing feed is information, not an obstacle.
- **Budget:** one fetch per run; ~2 minutes of CI. Stop after one pass.

## The five parts

| Part        | This loop's answer                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------- |
| **Trigger** | Cron, every six hours (`.github/workflows/news.yml`), plus `workflow_dispatch`.                 |
| **Inputs**  | `data/feeds.json` (enabled feeds), `data/news.json` (existing archive), `data/players.json`.    |
| **Action**  | Fetch each enabled feed, normalize, enrich, merge into the archive. One write, one file.        |
| **Check**   | Script exits 0, output parses against `NewsSchema`, no duplicate ids, `scripts/check.sh` green. |
| **Stop**    | Snapshot unchanged 🟰 / all feeds failed 🛑 / written and committed ✅                            |

## Prompt (run each pass)

> Run `npm run news:fetch`. Read the per-feed output.
>
> If a feed reports a non-200 or a parse failure, do **not** remove it from
> `data/feeds.json` — note it in `memory/handoff.md` so a human can decide
> whether the source moved or is temporarily down. One dead host is normal.
>
> If every feed failed, stop and report a blocker: that is a network or policy
> problem, not a data problem, and committing an unchanged file hides it.
>
> If `data/news.json` is unchanged, stop without committing. A no-op is a
> legitimate outcome — quiet news days exist.
>
> Otherwise commit `data/news.json` alone with the message `Refresh news
> snapshot` and push to `main`. The push triggers `pages.yml`, which redeploys.

## Notes for whoever reads this next

- Item ids hash the canonical URL, so the same story from two feeds collapses to
  one entry and citations in `data/insights.json` stay valid across passes.
- The merge preserves hand-added tags: refetching never undoes enrichment.
- Retention is capped (400 items, 120 days) because this file is committed and
  must not grow without bound.

## Hard stops (unattended runs)

- Max iterations: 1 per trigger — this loop does not retry inside a run.
- No-progress: an unchanged snapshot is success, not stagnation. Do not re-run.
- Budget: `${BUDGET_USD}`.
