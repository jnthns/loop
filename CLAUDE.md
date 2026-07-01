# CLAUDE.md

Claude Code entrypoint for this repository.

**All behavioral instructions live in [`AGENTS.md`](./AGENTS.md).** Read that file
first and follow it exactly — it is the single source of truth for how to work in
this loop-engineered repo (the loop workflow, the three hard stops, guardrails,
and the maker–checker split).

## Claude-specific notes

- Subagents are defined in [`.claude/agents/`](./.claude/agents/):
  - `planner` — turns `specs/spec.md` into an ordered `specs/PLAN.md`.
  - `maker` — implements one task per pass.
  - `checker` — adversarial verifier for the maker–checker split.
- Prefer running the checker in a fresh subagent (or via `scripts/verify.sh`) so
  the maker never grades its own homework.
- Use worktrees for isolated parallel work; keep durable state on disk in
  `specs/` and `memory/`, never only in context.
- A good on-ramp: `/loop` reading `loops/build.md`, with the stop condition being
  the `ALL TASKS DONE` sentinel in `specs/STATUS.md`.

Do not duplicate the guidance from `AGENTS.md` here; if something is missing,
update `AGENTS.md`, not this file.
