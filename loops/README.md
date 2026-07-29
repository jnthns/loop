# Loop Library

Reusable loop definitions. A **loop** is a task with a check plus explicit stop
rules — not a script and not an agent. Each file here is a filled-in copy of
[`_template.md`](./_template.md): a prompt an agent runs each pass, with a concrete
**Check** and **Stop**.

## How to use

- The runner `scripts/loop.sh` feeds one of these files to a fresh agent each
  iteration (default `loops/build.md`). Point it at another with `LOOP_FILE=...`.
- Or paste a loop's prompt into your tool's `/loop` / `/goal` command.
- Run any new loop **once by hand** before scheduling it — the first manual run
  almost always exposes a missing check or a fuzzy boundary.

## The loops

Generic — reusable in any repo:

| File                   | Use it to…                                                    |
| ---------------------- | ------------------------------------------------------------- |
| `_template.md`         | Author a new loop (Trigger, Inputs, Action, Check, Stop).     |
| `build.md`             | Build the app from `specs/` — the main Ralph-style loop.      |
| `test-stabilizer.md`   | Kill flaky tests until N green runs in a row.                 |
| `housekeeper.md`       | Remove dead code / stale files without breaking the build.    |
| `fresh-clone.md`       | Guarantee a clean clone reaches the documented ready state.   |
| `ui-score.md`          | Score and improve UI/UX against a fixed checklist.            |
| `red-team.md`          | Adversarially pressure-test a design before committing to it. |

App-specific — these are what make the dynasty guide compound over time:

| File                    | Trigger  | One bounded action per pass                                     |
| ----------------------- | -------- | ---------------------------------------------------------------- |
| `news-refresh.md`       | cron/6h  | Fetch feeds, dedupe, commit `data/news.json`.                    |
| `knowledge-curator.md`  | after refresh | Write or revise **one** cited article in the thinnest facet. |
| `roster-review.md`      | weekly   | Cross-reference roster × news × knowledge into `data/insights.json`. |

The last two write prose and advice unattended, so both carry an absolute rule:
**no uncited claims, no invented numbers.** The check enforces it — an article
with no `sources[]`, or a suggestion whose citation does not resolve, fails the
build rather than shipping.

## The rule every loop obeys

```
fresh inputs → one bounded change → fixed check → keep only verified wins → explicit stop
```

And every unattended loop halts on the **three hard stops**: max iterations,
no-progress, and budget. See `docs/loop-library.md` for authoring guidance and
`docs/guardrails.md` for safety.
