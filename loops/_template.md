# Loop: <NAME>

<!--
Universal loop template. Copy this file, rename it, and fill every bracket.
A loop is only trustworthy if all five parts below are explicit AND the stop
condition reads like a contract (end state + evidence + constraints + budget).
Delete these comments in your copy.
-->

## Contract (fill this in — it is the whole point)

- **End state (done means):** <the measurable result — a number, a passing test, a rubric score. NOT "make it better">
- **Evidence required:** <the exact proof — e.g. `scripts/check.sh` exits 0 and coverage report shows >= 90%>
- **Constraints (must hold):** <what must NOT change — e.g. do not touch public APIs, do not delete tests>
- **Budget:** <hard ceiling — e.g. stop after 25 passes or $5, whichever first>

## The five parts

| Part        | This loop's answer                                                  |
| ----------- | ------------------------------------------------------------------ |
| **Trigger** | <manual goal, or a timer/event for a scheduled loop>               |
| **Inputs**  | <the fresh state re-read each pass — files, test results, screens> |
| **Action**  | <the ONE bounded, reversible change allowed per pass>              |
| **Check**   | <the fixed, mechanical test run identically every pass>            |
| **Stop**    | success ✅ / no-op 🟰 / ask-approval 🙋 / blocked or out-of-budget 🛑 |

## Prompt (what the agent runs each pass)

> When [trigger], inspect [fresh inputs]. Choose one in-scope action using
> [criteria], then make the change.
>
> Run [acceptance check] under the same conditions. Record what changed, the
> evidence, and the next step in [state file].
>
> Repeat only while progress is measurable and [budget] remains. Stop when
> [success gate] passes. Stop without changes when [no-op condition] is true.
>
> Ask for approval or report a blocker when [escalation condition] occurs.
> Never [forbidden action]. Finish with [pull request, report, artifact, handoff].

## Hard stops (unattended runs)

- Max iterations: `${MAX_ITERATIONS}`
- No-progress: halt after `${MAX_NO_PROGRESS}` passes with no measurable change.
- Budget: halt at `${BUDGET_USD}`.
