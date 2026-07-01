# AGENTS.md — the single source of truth for agents in this repo

> This file is the canonical instruction set for **any** coding agent working in
> this repository (Cursor, Claude Code, Codex, Factory, Devin, or a plain CLI in
> a loop). Other tool-specific config files (`CLAUDE.md`, `.cursor/rules/*`,
> `.codex/*`) intentionally defer to this document. If they ever disagree, this
> file wins.

This repository is a **loop-engineered workspace**. The app it will eventually
build has not been chosen yet. What exists today is the *harness*: the outer-loop
system that lets an agent build, verify, and ship software autonomously and
safely. Read this whole file before doing anything.

---

## 1. The one sentence to remember

> **A loop is a task with a check. A task without a check is just hope.**

Your job is never "improve the code." Your job is always: take fresh state, make
**one** bounded change, run a **fixed mechanical check**, and record what
happened — then stop or continue based on explicit rules.

---

## 2. The loop you run every pass

```
OBSERVE → ACT → CHECK → DECIDE → (continue | stop) → HANDOFF
```

1. **Observe.** Read the current state from disk — never from memory of a prior
   run. The canonical inputs are:
   - `specs/spec.md` — what we are building and the acceptance criteria.
   - `specs/PLAN.md` — the ordered task checklist.
   - `specs/STATUS.md` — progress log + the `ALL TASKS DONE` sentinel.
   - `memory/handoff.md` — the last run's handoff (what was tried, what's next).
2. **Act.** Pick the **single** highest-priority unchecked task from
   `specs/PLAN.md`. Make one small, reversible change toward it. No grab-bags.
3. **Check.** Run `scripts/check.sh`. The check — not your opinion — decides
   whether the work is good. If it is red, fix the root cause or revert.
4. **Decide.** Continue only while progress is measurable and budget remains.
   Stop on success, no-op, blocked, or out-of-budget (see §5).
5. **Handoff.** Update `specs/PLAN.md` (tick the task), append evidence to
   `specs/STATUS.md`, and rewrite `memory/handoff.md` for the next run.
   Commit atomically. Then **exit** — the next iteration is a fresh agent.

The intelligence lives in clear specs and verifiable outcomes applied over and
over — **not** in one heroic long session. Keep each pass small enough to review.

---

## 3. Non-negotiable principles (the field's teachings)

These are distilled from the established practice of loop / agentic engineering
(Huntley's Ralph technique, Osmani's loop engineering, Cherny & Steinberger,
Willison's agentic patterns, and the community Loop Library). See `docs/`.

1. **Fresh context per task.** Assume you remember nothing between passes. State
   lives on disk (`specs/`, `memory/`), never only in the context window. The
   agent forgets; the repo doesn't.
2. **Small, atomic, reversible changes.** One coherent change per pass, one
   commit. Huge diffs are a bug, not productivity.
3. **Verification is built in, not bolted on.** Prefer building things as CLIs
   the agent can call and check. Close the loop: run the test, hit the endpoint,
   diff the screenshot.
4. **Evidence over claims.** "Tests pass" means paste the green run. "Done"
   means the check exits 0. Never mark partial or blocked work as complete.
5. **Maker ≠ checker.** The agent that wrote the code is a generous grader. A
   separate verifier (`scripts/verify.sh` / the `checker` subagent) grades the
   work, is adversarial, and trusts tests over its read of the diff.
6. **Freeze the check.** Do not move the benchmark between passes; you lose the
   ability to compare progress. Optimize against a fixed target.
7. **Skills compound, prompts don't.** If you do something more than once, or do
   something hard, capture it as a named skill in `skills/`. The loop is
   plumbing; the skills are the asset.
8. **Stay the engineer.** Read what the loop produced. Do not let comprehension
   debt or cognitive surrender creep in. Prefer understanding over throughput.

---

## 4. Every loop names five things

When you author or run a loop, all five must be explicit (see `loops/_template.md`):

| Part    | Question it answers                               |
| ------- | ------------------------------------------------- |
| Trigger | When does the loop run?                            |
| Inputs  | What fresh state is inspected each pass?           |
| Action  | What single bounded, reversible change is allowed? |
| Check   | What fixed test/benchmark/rubric decides success?  |
| Stop    | Success? No-op? Blocked? Out of budget?            |

## 5. The three hard stops (bake into every unattended loop)

A loop is delegated authority; it must halt. `scripts/loop.sh` enforces:

1. **Max iteration count** — a ceiling on passes (`MAX_ITERATIONS`).
2. **No-progress detection** — if `MAX_NO_PROGRESS` passes produce no measurable
   change (no new commit / check still red at the same point), halt.
3. **Budget** — a hard token/$ ceiling (`BUDGET_USD`).

Blocked, exhausted, and stagnant runs are **not** successful runs. Never dress
them up as done.

---

## 6. Guardrails (safety — see `docs/guardrails.md`)

- **Protected scope.** Never overwrite uncommitted work in progress. Only touch
  files relevant to the current task.
- **Gate consequential actions behind a human.** Production deploys, destructive
  ops (`rm -rf`, dropping data, force-push), financial actions, privacy-sensitive
  data, and external messages (email/Slack/PRs to third parties) require
  explicit human approval. When you hit one, stop and write the ask into
  `memory/handoff.md`.
- **Never store secrets** in `specs/`, `memory/`, `skills/`, commit messages, or
  logs. Use `.env` (git-ignored); see `.env.example`.
- **Prefer CLIs over heavy MCPs.** A named CLI the model already knows costs zero
  context and is self-documenting via `--help`. Reserve MCP for things a CLI
  can't do.

---

## 7. Repository map

| Path                     | Purpose                                                     |
| ------------------------ | ---------------------------------------------------------- |
| `AGENTS.md`              | This file — canonical agent instructions.                  |
| `CLAUDE.md`              | Claude Code entrypoint → defers here.                      |
| `.cursor/rules/`         | Always-applied Cursor rules → defer here.                  |
| `.claude/agents/`        | `planner`, `maker`, `checker` subagents (Claude Code).     |
| `.codex/agents/`         | `maker`, `checker` subagents (Codex).                      |
| `specs/spec.md`          | Source-of-truth product spec (fill in the app's purpose).  |
| `specs/PLAN.md`          | Ordered implementation checklist.                          |
| `specs/STATUS.md`        | Progress log + `ALL TASKS DONE` sentinel.                  |
| `memory/handoff.md`      | Durable per-run handoff. No secrets.                       |
| `loops/`                 | The Loop Library (reusable loop definitions).              |
| `skills/`                | Reusable named skills (`SKILL.md`).                        |
| `scripts/loop.sh`        | Ralph-style runner with the three hard stops.              |
| `scripts/check.sh`       | Unified mechanical check (lint + test + build).            |
| `scripts/verify.sh`      | Maker–checker gate (runs the checker).                     |
| `scripts/lib/`           | Budget + guardrail helpers.                                |
| `docs/`                  | The discipline, maturity ladder, guardrails, loop authoring.|
| `.github/workflows/`     | CI runs the check as external back-pressure.               |

---

## 8. Conventions

- **Commits:** one logical change per commit; imperative subject
  (`Add spec template`), body explains *why*. Never `git commit --amend` or
  force-push shared branches unless a human asks.
- **Task list format in `specs/PLAN.md`:** GitHub checkboxes `- [ ]` / `- [x]`,
  ordered by priority. Add discovered work as new unchecked items rather than
  silently expanding the current task.
- **When the plan is empty:** if `specs/spec.md` still has unfilled `TODO`
  placeholders, the correct first action is to help fill the spec (or run the
  `create-spec` skill), not to write app code.
- **Definition of done for the whole build:** every item in `specs/PLAN.md` is
  checked, `scripts/check.sh` exits 0, the checker approves, and `specs/STATUS.md`
  contains the line `ALL TASKS DONE`.

---

## 9. Quick start for a human

```bash
cp .env.example .env      # set AGENT_CMD, budgets, keys
# 1) Describe the app in specs/spec.md and break it into specs/PLAN.md
# 2) Dry-run the harness with a mock agent:
AGENT_CMD=echo MAX_ITERATIONS=1 scripts/loop.sh
# 3) When happy, point AGENT_CMD at a real agent CLI and let it run.
```

Start on a **low maturity rung** (triage / draft PRs), watch the token bill, and
only climb once the loop produces work you'd have merged by hand. See
`docs/maturity-ladder.md`.
