---
name: run-checks
description: Run this project's mechanical check the canonical way and read its result honestly. Use before claiming any task done and after every change.
---

# Skill: run the checks

The check — not your opinion — decides whether work is good. Run it the same way
every time so results are comparable.

## The canonical command

```bash
scripts/check.sh
```

This is the single entry point for lint + test + build. CI runs the exact same
script (`.github/workflows/verify.yml`), so "green locally" means "green in CI."

- Exit code `0` = pass. Anything else = fail.
- Until a real project exists, `check.sh` is a passing no-op with TODOs; wire in
  the chosen stack's real commands as part of Phase 0 (see `specs/PLAN.md`).

## Rules

- **Reproduce, don't trust.** Never accept a reported result — run it yourself.
- **Never weaken the check to pass.** No skipping tests, lowering thresholds,
  deleting assertions, or `|| true`. Fix the root cause or revert.
- **Freeze the check.** Don't change the benchmark mid-loop; you lose the ability
  to compare passes. When tuning against data, evaluate on a fresh holdout.
- **Record real evidence.** Paste the actual output (or its tail) into
  `specs/STATUS.md`, not "tests pass."

## Adding checks

When you add a capability, add the check that proves it (a test, a benchmark,
a lint rule) and wire it into `scripts/check.sh` so every future pass enforces it.
Prefer building features as CLIs the agent can call and verify — close the loop.
