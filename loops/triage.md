# Loop: triage

Turn fresh signals from CI, the mechanical check, and dependency health into
**queued** goals on `specs/BACKLOG.md` — without writing application code.

## Contract

- **End state:** actionable findings are recorded as new `queued` goals (or a
  single discovery note in `memory/handoff.md` when no new goal is warranted).
- **Evidence required:** each new backlog item cites the signal that triggered it
  (CI run URL, failing test name, audit finding). No duplicate goals for the
  same issue.
- **Constraints:** do not implement fixes in this loop. Do not tick tasks in
  `specs/PLAN.md`. Append-only on `BACKLOG.md` for new goals. Never read `.env`.
- **Budget:** stop after `MAX_ITERATIONS` passes or `BUDGET_USD`.

## The five parts

| Part        | Answer                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| **Trigger** | Manual, scheduled cadence, or `LOOP_FILE=loops/triage.md scripts/loop.sh`. |
| **Inputs**  | `gh run list` / latest CI status, `scripts/check.sh` output, `npm audit` (if available), `specs/BACKLOG.md`, `specs/STATUS.md`, `memory/handoff.md`. |
| **Action**  | Inspect signals; append at most one new `queued` goal per pass (or record no-op). |
| **Check**   | New goal block is well-formed in `BACKLOG.md`; no app source files changed. |
| **Stop**    | signals triaged ✅ / nothing actionable 🟰 / needs human 🙋 / budget 🛑 |

## Prompt (run each pass)

> Fresh context. Read `AGENTS.md`, `specs/BACKLOG.md`, `specs/STATUS.md`, and
> `memory/handoff.md`.
>
> **Observe** — gather signals (run what is available; skip gracefully if a tool
> is missing):
>
> 1. **CI:** `gh run list --limit 5` and, if the latest run failed,
>    `gh run view <id> --log-failed`. Note failing job/step.
> 2. **Local check:** `scripts/check.sh` (or `npm run lint && npm run test &&
>    npm run build` on Windows without bash). Capture failures.
> 3. **Dependencies:** `npm audit --audit-level=high` if `package.json` exists.
>    Note high/critical issues not already tracked in the backlog.
> 4. **Deploy drift:** if `memory/handoff.md` or recent `STATUS.md` entries
>    mention production/deploy gaps, consider whether a goal already exists.
>
> **Decide** — for the **single highest-priority** actionable finding:
>
> - If an equivalent goal already exists in `BACKLOG.md` (same problem), record
>   a no-op in `memory/handoff.md` and stop.
> - If the finding is blocked on a human (secrets, billing, destructive action),
>   write the ask to `memory/handoff.md` and stop.
> - Otherwise append **one** new goal block at the bottom of `specs/BACKLOG.md`:
>
>   ```markdown
>   ## goal-NNN — Short title
>
>   - **Status:** queued
>   - **Summary:** one line
>   - **Motivation:** cite the signal (e.g. "CI pages.yml failed on lint step")
>   - **Acceptance sketch:** measurable done state
>   ```
>
>   Use the next sequential `goal-NNN` id. Do not promote to `active` — intake
>   does that after the current campaign finishes.
>
> **Hand off**
>
> 1. Rewrite `memory/handoff.md` with what you observed, what you queued (or why
>    not), and suggested next step.
> 2. Commit locally with message like `Triage: queue goal-NNN for <issue>`.
>    **Do not push** — `scripts/loop.sh` pushes only after `scripts/verify.sh`
>    APPROVEs.
> 3. Stop.
>
> Never modify application source in triage. Never read `.env`.

## Hard stops

- Max iterations: `${MAX_ITERATIONS}` · No-progress: `${MAX_NO_PROGRESS}` · Budget: `${BUDGET_USD}`.
