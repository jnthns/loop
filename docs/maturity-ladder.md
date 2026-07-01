# The maturity ladder — adopt loops safely

Don't jump straight to an auto-merging loop. Earn trust one rung at a time, and
only climb when the current rung is already producing work you'd have done by hand
anyway. Each level adds exactly one new power and keeps a human in the path until
the evidence says you can step back.

| Level          | What the loop does                                            | What you do                     |
| -------------- | ------------------------------------------------------------ | ------------------------------- |
| 0 — Manual     | you prompt turn by turn                                       | every turn                      |
| 1 — Triage     | scheduled run writes findings to a markdown file; no code     | read and act on the findings    |
| 2 — Draft      | drafts fixes on a branch in an isolated worktree              | review and merge every PR       |
| 3 — Verified PR| a verifier sub-agent gates the PR before it reaches you       | approve; the verifier filters   |
| 4 — Auto-merge | low-risk classes (dep bumps, lint, flaky retries) merge green | audit the log, not each change  |

## How to climb

- **Start smaller than you think.** A single automation that triages CI failures
  into a markdown file each morning — no auto-merge — already removes a recurring
  chore and lets you watch how the loop behaves before you trust it with PRs.
- **Only promote a class of work, not everything at once.** e.g. auto-merge
  dependency bumps long before you'd auto-merge feature code.
- **Demote instantly** if a rung starts producing work you wouldn't have merged.

## Watch the token bill

A scheduled loop with a verifier running after every turn burns tokens fast, and
usage swings wildly with cadence and sub-agent count. Start with a slow cadence
and a tight goal, watch cost for a few days, and scale only once the loop produces
work you actually merge. The three hard stops (`docs/guardrails.md`) are your
circuit breakers — never disable them.

## You are still the ceiling

Worktrees remove the mechanical collision between parallel agents, but **your
bandwidth to review merged work caps how many you can actually run.** Ten agents
producing changes you can't review is worse than two you can. Comprehension debt
(not understanding what the loop shipped) is the real risk — read what it
produced.

## In this repo

- Level 0–1 today: run `scripts/loop.sh` with `AGENT_CMD=echo` (dry run), or point
  a real agent at a triage loop that only writes to `memory/` / `specs/STATUS.md`.
- Level 2–3: let the `maker` draft on a branch and require `scripts/verify.sh`
  (the `checker`) to pass before you review.
- Level 4: reserve for narrowly-scoped, low-risk loops with green CI as the gate.
