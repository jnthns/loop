# Loop: roster-review

Reads the actual roster against the actual news and writes down what to do about
it. This is the loop that makes the guide *yours* rather than generic — and the
one with the most room to be confidently wrong, so its constraints are the
tightest in the repo.

## Contract

- **End state (done means):** one dated briefing appended to `data/insights.json`,
  where every suggestion cites at least one news item id or knowledge article
  slug that exists in the repo.
- **Evidence required:** `scripts/check.sh` exits 0; the insights schema parses;
  every `newsRefs` entry resolves to an id in `data/news.json` and every
  `knowledgeRefs` entry resolves to an article path.
- **Constraints (must hold):**
  - **No uncited suggestion.** `hasCitation()` is the floor, not the goal.
  - **No invented statistics, no invented transactions.** If the news does not
    say it, it did not happen.
  - Do not modify `data/team.json`. Roster changes are the manager's call; this
    loop advises, it does not act.
  - Do not touch player values or write rankings. Advise on *this* roster.
  - Keep suggestions to at most five per briefing. A list of twenty is a list
    nobody reads.
- **Budget:** one briefing per pass, weekly.

## The five parts

| Part        | This loop's answer                                                                                     |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| **Trigger** | Weekly, or after a `news-refresh` pass that produced roster alerts.                                       |
| **Inputs**  | `data/team.json`, `data/news.json`, `src/content/knowledge/**`, `data/insights.json` (prior briefings).    |
| **Action**  | Write **one** dated briefing: what changed, and at most five cited suggestions.                           |
| **Check**   | `scripts/check.sh` — schema validity plus citation resolution.                                            |
| **Stop**    | Briefing committed ✅ / nothing changed since the last one 🟰 / roster data looks stale 🙋 / budget 🛑        |

## Prompt (run each pass)

> Read `AGENTS.md`, then `data/team.json` — the committed file, which is the only
> roster this loop knows about. Local browser edits are invisible here by design.
>
> Compute the same intersection the dashboard does: news items from the last
> ~14 days mentioning rostered or targeted players.
>
> For each meaningful change, write a suggestion with: `kind`
> (buy/sell/hold/watch/roster-move), a headline a manager can act on, the detail
> including **why**, the players involved, and the `newsRefs` / `knowledgeRefs`
> that back it. Set `confidence` honestly — most suggestions are `medium` at best.
>
> Ground the reasoning in the knowledge base rather than restating it. If the
> advice depends on a principle, cite the article; if no article covers it, that
> is a gap for `knowledge-curator`, not something to argue from scratch here.
>
> If nothing material changed, stop and write nothing. A briefing that says
> "no changes" every week trains the reader to ignore briefings.
>
> Never suggest an action you cannot tie to a specific item. "Consider trading
> for a young QB" without a triggering event is horoscope writing, not advice.
>
> Run `scripts/check.sh`. On green, commit `data/insights.json` alone, rewrite
> `memory/handoff.md`, and stop.

## Why the citation rule is absolute

An unattended loop writing plausible-sounding fantasy advice is exactly the
failure mode this repo exists to prevent. The citation requirement makes every
claim traceable to something a human can open and disagree with. A suggestion
that cannot be traced is not a weaker suggestion — it is not a suggestion, and
the check rejects it.

## Hard stops (unattended runs)

- Max iterations: 1 per trigger.
- No-progress: an unchanged week is success. Do not manufacture a briefing.
- Budget: `${BUDGET_USD}`.
