# Loop: test-stabilizer

Eliminate flaky tests by fixing root causes, until the suite is reliably green.

## Contract

- **End state:** the full test suite passes `N` consecutive times (default N=10).
- **Evidence required:** `N` green full-suite runs in a row, logged in the
  handoff — no run skipped, no test disabled to get there.
- **Constraints:** fix flakes at the root (shared state, timing, ordering,
  external deps). NEVER paper over with a blind `sleep`, a retry wrapper, a
  `skip`, or by deleting the test. Do not change unrelated code.
- **Budget:** stop after `MAX_ITERATIONS` passes or `BUDGET_USD`.

## The five parts

| Part        | Answer                                                                 |
| ----------- | --------------------------------------------------------------------- |
| **Trigger** | Manual, or scheduled when CI reports intermittent failures.            |
| **Inputs**  | Test suite output across repeated runs; the flaky test's source.       |
| **Action**  | Fix the single most frequent flake at its root cause.                  |
| **Check**   | Run the whole suite repeatedly; count consecutive green runs.          |
| **Stop**    | N green in a row ✅ / no flakes found 🟰 / can't reproduce 🙋 / budget 🛑 |

## Prompt (run each pass)

> Fresh context. Run the full test suite several times and identify tests whose
> result changes between runs. Pick the most frequent flake. Diagnose the root
> cause (shared/global state, timing/race, test ordering, external dependency,
> non-deterministic data). Fix that root cause only — do not add `sleep`,
> retries, skips, or delete the test. Re-run the full suite. Record in
> `memory/handoff.md` how many consecutive green runs you have achieved and what
> you fixed. Stop when you reach N consecutive green full-suite runs, or when no
> flake reproduces, or on budget.

## Hard stops

- Max iterations: `${MAX_ITERATIONS}` · No-progress: `${MAX_NO_PROGRESS}` · Budget: `${BUDGET_USD}`.
