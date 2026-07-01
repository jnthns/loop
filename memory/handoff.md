# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

Set up the loop-engineering harness, then help fill `specs/spec.md` so a real
build can begin. The app's purpose is not chosen yet.

## Last pass did

- Scaffolded the harness (instructions, subagents, specs, loops, skills, scripts,
  docs, CI).

## Evidence

- `scripts/check.sh` exits 0 on the empty repo.

## Blockers / needs a human

- `specs/spec.md` still has `TODO` placeholders — the product's purpose must be
  decided before app code is written.

## Next step

1. Fill `specs/spec.md` (use `skills/create-spec/SKILL.md`).
2. Run the `planner` subagent to expand `specs/PLAN.md`.
3. Start the build loop: `scripts/loop.sh` (see `loops/build.md`).
