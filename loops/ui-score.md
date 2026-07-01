# Loop: ui-score

Improve UI/UX by scoring the real interface against a fixed checklist and fixing
the weakest safe area each pass — keeping only regression-free changes.

## Contract

- **End state:** every screen scores at or above the agreed threshold on the
  fixed checklist, with no functional regressions.
- **Evidence required:** before/after screenshots at the agreed sizes from a
  fresh browser session, the checklist scores, and green `scripts/check.sh`.
- **Constraints:** use ONE fixed checklist and fixed screen sizes; do not move the
  rubric between passes. Change one area per pass. Keep changes that don't
  regress other screens; otherwise revert.
- **Budget:** stop after `MAX_ITERATIONS` passes or `BUDGET_USD`.

## The five parts

| Part        | Answer                                                                      |
| ----------- | ------------------------------------------------------------------------- |
| **Trigger** | Manual, on a UI branch.                                                     |
| **Inputs**  | Screens captured in a real browser from a fresh session, at fixed sizes.    |
| **Action**  | Improve the single weakest safe area on the lowest-scoring screen.          |
| **Check**   | Re-score with the same checklist; run the flow; `scripts/check.sh` green.   |
| **Stop**    | All screens ≥ threshold ✅ / two passes no gain 🟰 / needs product call 🙋 / budget 🛑 |

## Prompt (run each pass)

> Fresh context. In a real browser from a fresh session, capture the app's screens
> at the agreed sizes. Score each with the one fixed UI/UX checklist (hierarchy,
> spacing, contrast/accessibility, states, responsiveness, copy). Pick the weakest
> safe area on the lowest-scoring screen and make one focused improvement. Re-run
> the whole flow and re-capture. Keep the change only if its score improves and no
> other screen regressed and `scripts/check.sh` stays green — otherwise revert.
> Record scores and screenshots in `memory/handoff.md`. Stop when every screen
> meets the threshold, or after two consecutive passes with no gain, or on budget.

## Hard stops

- Max iterations: `${MAX_ITERATIONS}` · No-progress: `${MAX_NO_PROGRESS}` · Budget: `${BUDGET_USD}`.
