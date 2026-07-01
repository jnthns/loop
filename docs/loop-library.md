# Authoring loops & the starter library

A **loop** is a task with a check plus explicit stop rules. This repo ships a
starter library in `loops/`; this doc explains how to write good ones.

## The universal template

Every loop names five things (`loops/_template.md`):

| Part    | Question it answers                                | Failure if missing                 |
| ------- | ------------------------------------------------- | ---------------------------------- |
| Trigger | When does the loop run?                            | Never starts / wrong time          |
| Inputs  | What fresh state is inspected each pass?           | Acts on stale assumptions          |
| Action  | What single bounded, reversible change is allowed? | Huge blast radius, impossible undo |
| Check   | What fixed test/benchmark/rubric decides success?  | "Looks done" while broken          |
| Stop    | Success? No-op? Blocked? Out of budget?            | Infinite loop, wasted tokens       |

## Write the stop condition like a contract

A goal is only as good as the evidence that proves it.

| Dimension  | A wish (don't)          | A contract (do)                                         |
| ---------- | ----------------------- | ------------------------------------------------------ |
| End state  | "Improve test coverage" | "Coverage for `src/billing` is >= 90%"                 |
| Evidence   | "It looks done"         | "`scripts/check.sh` exits 0 and the coverage report confirms" |
| Constraints| (unstated)              | "Do not touch public APIs or delete existing tests"    |
| Budget     | (unbounded)             | "Stop after 25 passes or $5, whichever comes first"    |

## The pattern every loop obeys

```
fresh inputs → one change → fixed check → keep only verified wins → explicit stop
```

## Two flavors

- **Goal loop** — starts manually, runs until the check passes or budget runs out
  (e.g. "stabilize the test suite").
- **Scheduled loop** — starts on a timer/event, does its bounded work, reports,
  waits for the next trigger (e.g. a five-minute repo maintainer).

## Run it once by hand first

The first manual pass almost always reveals a missing check, a fuzzy boundary, or
a stop that needs sharpening. Do that before scheduling — `AGENT_CMD=echo
MAX_ITERATIONS=1 scripts/loop.sh` gives you a safe dry run of the mechanics.

## The starter library (`loops/`)

| Loop                 | End state                                                   | Check                                   |
| -------------------- | ---------------------------------------------------------- | --------------------------------------- |
| `build.md`           | every `specs/PLAN.md` task done, acceptance criteria met    | `scripts/check.sh` + checker + sentinel |
| `test-stabilizer.md` | suite passes N times in a row                               | N consecutive green full-suite runs     |
| `housekeeper.md`     | no safe cleanups remain; build stays green                  | `scripts/check.sh` green after each removal |
| `fresh-clone.md`     | a clean clone reaches the ready state via README only       | a clean clone actually runs             |
| `ui-score.md`        | every screen >= threshold on the fixed checklist            | re-score + run flow + check green       |
| `red-team.md`        | no open high-impact objection                               | objection log: fixed or accepted        |

## The five building blocks behind a self-running loop

1. **Automations** — scheduled discovery + triage (the heartbeat).
2. **Worktrees** — isolate parallel agents so they don't collide.
3. **Skills** — codify durable project knowledge (`skills/*/SKILL.md`).
4. **Connectors** — reach real tools (prefer CLIs; use MCP only when needed).
5. **Sub-agents** — separate maker from checker (`.claude/agents/`, `.codex/agents/`).
6. **+ Memory** — durable state between runs (`specs/`, `memory/`), never secrets.

Two of these decide whether a loop lives or dies: **memory** (state on disk, not
in context) and the **maker–checker split** (a separate model grades the work).
