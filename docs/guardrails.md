# Guardrails — non-negotiable

A loop is delegated authority. Bound it. These rules are enforced by
`scripts/loop.sh`, `scripts/lib/guardrails.sh`, and `.cursor/rules/guardrails.mdc`,
and every agent must follow them.

## The three hard stops

Every unattended loop must be able to halt on its own. `scripts/loop.sh` enforces
all three:

1. **Max iteration count** (`MAX_ITERATIONS`) — a ceiling on passes, full stop.
2. **No-progress detection** (`MAX_NO_PROGRESS`) — if N passes produce no
   measurable change (no new commit), halt instead of grinding.
3. **Budget** (`BUDGET_USD`) — a hard spend ceiling that ends the run. Track spend
   via `scripts/lib/budget.sh` (`COST_PER_ITERATION_USD` or real per-pass numbers).

> The romantic version of loops is that you write them and a thousand agents build
> your company overnight. The production version is that you write the loops, and
> most of your job is making sure they halt.

Blocked, exhausted, and stagnant runs are **not** successful runs. Never let an
agent dress them up as done.

## Set hard limits

Time, cost, retry count, iteration count, and affected scope. A loop must never
read "keep going" as unlimited authority.

## Keep the check stable

Don't move the benchmark after every result, or progress becomes impossible to
compare. When optimizing a prompt or model, evaluate against a fresh holdout set
so you're not overfitting to the cases you've been tuning on.

## Gate consequential actions behind a human

These require explicit human approval. When an agent hits one, it must stop and
write the request into `memory/handoff.md`:

- Production deploys and release promotion.
- Destructive operations: `rm -rf`, dropping/truncating data, `git push --force`,
  history rewrites, deleting branches.
- Financial actions; anything touching money or billing.
- Privacy-sensitive data and credentials.
- External messages: email, Slack/Discord, comments/PRs on third-party repos.

`guardrails_forbidden_cmd` in `scripts/lib/guardrails.sh` flags obvious cases, but
judgment is required — the list is not exhaustive.

## Protect work in progress

`guardrails_protect_wip` refuses to start the loop with a dirty tree (override
only with `ALLOW_DIRTY=1` when you intend it). Agents must only touch files
relevant to the current task and never clobber uncommitted human work.

## Never store secrets

Not in `specs/`, `memory/`, `skills/`, commit messages, or logs. Secrets live only
in git-ignored `.env` (see `.env.example`). `guardrails_scan_secrets` is a
best-effort tripwire, not a real scanner — don't rely on it alone.

## Demand evidence, not claims

"Tests pass" means show the green run. "Production verified" means show the proof.
The state files record actual check output, not summaries. The maker–checker split
(`scripts/verify.sh`) exists precisely because agents will otherwise mark partial
work complete.

## Common failure modes → fixes

| Symptom                         | Root cause                       | Fix                                            |
| ------------------------------- | -------------------------------- | ---------------------------------------------- |
| Loop runs forever               | no budget / no stop              | the three hard stops                           |
| "Done" but broken               | check is the agent's opinion     | a mechanical, fixed check (`scripts/check.sh`) |
| Huge unreviewable diff          | action wasn't bounded            | one reversible change per pass                 |
| Looks better, performs worse    | check moved between passes       | freeze the check; use a holdout                |
| Acts on wrong assumptions       | stale inputs                     | re-inspect fresh state every pass              |
| Overwrites your WIP             | no protected scope               | `guardrails_protect_wip`; scope the loop       |
| Token/cost blowups              | context bloat, no limits         | cap iterations/cost; prefer CLIs over MCPs     |
| Quality degrades over long run  | context fills with cruft         | fresh context each pass; state on disk         |
| Verifier rubber-stamps the work | maker grading its own homework   | separate checker; trust tests over the diff    |
| You no longer understand repo   | comprehension debt               | read what the loop produced; review merges     |
