# Loop: news-refresh

Keeps the committed data snapshot current — the real league from Sleeper, and
the news from RSS + ESPN. This is the loop the whole app sits on: nothing else in
the repo touches the network, so if this stops, the guide quietly goes stale
while still looking fine.

Both halves run in `.github/workflows/refresh.yml`. The Sleeper sync goes first,
because news enrichment matches against the player file and a fresh roster makes
the same run's tagging better.

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
| **Trigger** | Cron, every six hours (`.github/workflows/refresh.yml`), plus `workflow_dispatch`.                 |
| **Inputs**  | `data/sleeper.json`, `data/feeds.json`, `data/news.json`, `data/players.json`, `data/team.json`. |
| **Action**  | Sync the league from Sleeper, then fetch and merge news. Writes only under `data/`.             |
| **Check**   | Both scripts exit 0 and `scripts/check.sh` is green — schemas, no duplicate ids, build passes.  |
| **Stop**    | Snapshot unchanged 🟰 / all sources failed 🛑 / league ambiguous 🙋 / written and committed ✅     |

## Prompt (run each pass)

> Run `npm run sync:sleeper`, then `npm run news:fetch`. Read both outputs.
>
> If the Sleeper sync reports several candidate leagues, stop: it has written
> them to `data/sleeper.json` and a human must pick one. Do not guess.
>
> If the Sleeper sync fails for any other reason, it wrote nothing — the
> committed roster is intact. Note it and continue with the news fetch; a
> Sleeper outage must not cost a news refresh.
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
