# Loop: intake

Promote the next queued goal from `specs/BACKLOG.md` into an active build
campaign after the current one reaches `ALL TASKS DONE`. Archives the finished
campaign, updates the spec, regenerates the plan, and clears the sentinel.

## Contract

- **End state:** the top `queued` goal in `specs/BACKLOG.md` is `active`; its
  requirements are reflected in `specs/spec.md`; `specs/PLAN.md` is a fresh
  ordered checklist; `specs/STATUS.md` has no `ALL TASKS DONE` sentinel.
- **Evidence required:** archived `PLAN.md` + `STATUS.md` under
  `specs/archive/<nn>-<slug>/`; goal status updated in `BACKLOG.md`; planner-style
  tasks in `PLAN.md` each name a check; `scripts/check.sh` still exits 0 (no
  regressions from archival edits alone).
- **Constraints:** one goal promoted per pass. Do not start implementing plan
  tasks — intake only sets up the next campaign. Never read `.env`.
- **Budget:** one pass; stop after this handoff.

## The five parts

| Part        | Answer                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| **Trigger** | `ALL TASKS DONE` in `specs/STATUS.md` and at least one `queued` goal in `specs/BACKLOG.md` (invoked by `scripts/loop.sh`). |
| **Inputs**  | `specs/BACKLOG.md`, `specs/spec.md`, `specs/PLAN.md`, `specs/STATUS.md`, `specs/archive/`, `AGENTS.md`, `.claude/agents/planner.md`. |
| **Action**  | Archive finished campaign; promote next goal into spec; regenerate plan; reset status; update backlog statuses. |
| **Check**   | `scripts/check.sh` exits 0; archive folder exists; no `ALL TASKS DONE` in fresh `STATUS.md`; promoted goal is `active`. |
| **Stop**    | intake complete ✅ / no queued goals 🟰 / spec gaps need human 🙋 |

## Prompt (run each pass)

> You are one **intake** pass with a fresh context. Read `AGENTS.md`, then read
> `specs/BACKLOG.md`, `specs/spec.md`, `specs/PLAN.md`, `specs/STATUS.md`, and
> `memory/handoff.md`.
>
> **Precondition:** `specs/STATUS.md` must contain `ALL TASKS DONE`. If not, stop
> and report — intake is not needed.
>
> **Precondition:** `specs/BACKLOG.md` must have at least one goal with
> **Status:** `queued`. If none, stop — the loop should exit success.
>
> **Step 1 — Archive the finished campaign**
>
> 1. Identify the goal that just completed (the most recent `done` goal, or infer
>    from the current `specs/spec.md` one-line summary).
> 2. Choose the next archive folder name: `specs/archive/<nn>-<slug>/` where
>    `<nn>` is zero-padded sequence (01, 02, …) and `<slug>` is a short kebab-case
>    title. Skip if that campaign is already archived.
> 3. Copy the current `specs/PLAN.md` and `specs/STATUS.md` into the archive
>    folder. Write `meta.md` with goal id, title, archive date, and summary.
> 4. Mark the completed goal **Status:** `done` in `BACKLOG.md` (if not already).
>
> **Step 2 — Promote the next goal**
>
> 1. Take the **first** goal with **Status:** `queued` (top to bottom in
>    `BACKLOG.md`).
> 2. Mark it **Status:** `active`.
> 3. Update `specs/spec.md`:
>    - Revise §1 one-line summary, §2 problem/users if needed.
>    - Replace §3 goals and §6 acceptance criteria to match the promoted goal's
>      summary and acceptance sketch.
>    - Update §4 non-goals and §5 constraints as needed.
>    - Keep app-wide decisions that still apply; do not wipe unrelated context.
> 4. Regenerate `specs/PLAN.md` following the **planner** contract
>    (`.claude/agents/planner.md`): atomic `- [ ]` tasks, top = do next, each
>    task ends with `(check: ...)`.
> 5. Reset `specs/STATUS.md` to a fresh header **without** `ALL TASKS DONE`:
>
>    ```markdown
>    # Build Status Log
>
>    > Durable, append-only progress log for the current campaign.
>
>    ## Sentinel
>
>    _(none — build in progress)_
>
>    ---
>
>    ## Log
>
>    ### Pass 0 — intake promoted <goal-id>
>
>    - Promoted **<goal-id> — <title>** from backlog.
>    - Archived previous campaign to `specs/archive/<nn>-<slug>/`.
>    - Next: first unchecked task in `specs/PLAN.md`.
>    ```
>
> **Step 3 — Verify and hand off**
>
> 1. Run `scripts/check.sh`. If it fails, fix only intake-related doc issues or
>    revert — do not implement plan tasks in this pass.
> 2. Rewrite `memory/handoff.md` (goal, change, evidence, blockers, next step).
> 3. Commit locally with an imperative message (e.g. `Intake: promote goal-002`).
>    **Do not push** — `scripts/loop.sh` pushes only after `scripts/verify.sh`
>    APPROVEs.
> 4. Stop. The next loop iteration runs `loops/build.md` on the new plan.
>
> Never read `.env`. Never implement application features in intake — only
> spec/plan/status/backlog/archive changes.

## Hard stops

- One goal per intake pass.
- If the promoted goal's acceptance sketch is too vague to plan, stop and write
  the clarification ask to `memory/handoff.md` — do not guess.
