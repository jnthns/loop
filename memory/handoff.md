# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

Add goal spine so the loop can iterate across multiple campaigns (backlog, intake, triage).

## Last pass did

- Added `specs/BACKLOG.md` goal queue with goal-001 (done) and goal-002 (queued).
- Archived completed recipe-generator campaign to `specs/archive/01-recipe-generator/`.
- Added `loops/intake.md` (promote next goal after `ALL TASKS DONE`) and `loops/triage.md` (CI/check → backlog).
- Updated `scripts/loop.sh`: intake on done+queued backlog; `git push` only after `verify.sh` APPROVE.
- Default `COST_PER_ITERATION_USD=0.25` in `budget.sh` / `.env.example`.
- Extended `.gitignore` for `.astro/`, `.tmp-home.html`, vitest cache.

## Evidence

- Harness docs updated: `AGENTS.md`, `README.md`, `loops/README.md`, `loops/build.md`.
- App sources committed to `main` (see git log).

## Blockers / needs a human

- None for spine work. goal-002 (live Gemini on static Pages) needs an architecture decision before intake promotes it.

## Next step

- Run `LOOP_FILE=loops/triage.md scripts/loop.sh` to queue goals from CI signals, or
- Let `scripts/loop.sh` run intake to promote goal-002 when ready to start that campaign.
