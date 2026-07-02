# Loop: build (the main Ralph-style build loop)

The default loop for `scripts/loop.sh`. It builds the app described in `specs/`
one verified task at a time, with a fresh context each pass.

## Contract

- **End state:** every task in `specs/PLAN.md` is `- [x]` and every acceptance
  criterion in `specs/spec.md` §6 is met.
- **Evidence required:** `scripts/check.sh` exits 0, the `checker` approves, and
  `specs/STATUS.md` ends with `ALL TASKS DONE`.
- **Constraints:** one task per pass; small reversible diffs; do not weaken or
  delete checks/tests; obey `docs/guardrails.md`; do not exceed `specs/spec.md`.
- **Budget:** stop after `MAX_ITERATIONS` passes, `MAX_NO_PROGRESS` idle passes,
  or `BUDGET_USD`.

## The five parts

| Part        | Answer                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| **Trigger** | Manual goal — a human starts `scripts/loop.sh` (or a scheduled kickoff).  |
| **Inputs**  | `specs/spec.md`, `specs/PLAN.md`, `specs/STATUS.md`, `specs/BACKLOG.md`, `memory/handoff.md`. |
| **Action**  | Implement the single highest-priority unchecked task in `specs/PLAN.md`.  |
| **Check**   | `scripts/check.sh` (lint + test + build) and any task-specific test.      |
| **Stop**    | `ALL TASKS DONE` present ✅ (and backlog empty) / no unchecked task 🟰 / blocker 🙋 / budget 🛑 |

## Prompt (run each pass)

> You are one iteration of an autonomous build loop with a fresh context. Read
> `AGENTS.md`, then read fresh state from `specs/spec.md`, `specs/PLAN.md`,
> `specs/STATUS.md`, and `memory/handoff.md`.
>
> If `specs/spec.md` still contains `TODO` placeholders, do NOT write app code —
> instead help complete the spec (see `skills/create-spec/SKILL.md`), record it,
> and stop.
>
> Otherwise pick the single highest-priority unchecked task in `specs/PLAN.md`.
> Make one small, reversible change to accomplish it. Write or update the test
> that proves it (red → green). Run `scripts/check.sh`. If it fails, fix the root
> cause or revert — never weaken the check.
>
> On green: tick the task in `specs/PLAN.md`, append the real check output as
> evidence to `specs/STATUS.md`, rewrite `memory/handoff.md` (goal, change,
> evidence, blockers, next step — no secrets), and commit locally with an
> imperative message. **Do not push** — `scripts/loop.sh` runs
> `scripts/verify.sh` and pushes to `main` only on APPROVE. Then stop.
>
> If every task is checked and `scripts/check.sh` is green, append the line
> `ALL TASKS DONE` to `specs/STATUS.md` and stop. If `specs/BACKLOG.md` has
> queued goals, `scripts/loop.sh` will run intake to start the next campaign.
>
> Never read `.env` — use `.env.example` only. Never `git push` yourself during
> a loop pass. Never force-push,
> delete data, or message third parties without human approval — record such
> needs in `memory/handoff.md` and stop.

## Hard stops (enforced by `scripts/loop.sh`)

- Max iterations: `${MAX_ITERATIONS}` · No-progress: `${MAX_NO_PROGRESS}` · Budget: `${BUDGET_USD}`.
- After each pass, `scripts/verify.sh` runs the `checker`; a REJECT does not tick
  the task.
