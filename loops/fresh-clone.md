# Loop: fresh-clone

Guarantee that a brand-new clone reaches the documented ready state by following
ONLY the README — fixing docs/setup until it works from zero.

## Contract

- **End state:** one uninterrupted fresh clone reaches the documented ready state
  following only the README, carrying no hidden local knowledge.
- **Evidence required:** a clean clone in a disposable environment actually runs
  to the ready state (build/dev/test command succeeds), captured in the handoff.
- **Constraints:** fix the docs/setup, not your shell history. When a step fails
  or assumes missing knowledge, record the gap, fix it, discard the environment,
  and start over carrying nothing.
- **Budget:** stop after `MAX_ITERATIONS` passes or `BUDGET_USD`.

## The five parts

| Part        | Answer                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| **Trigger** | Manual, or scheduled after onboarding-doc changes.                       |
| **Inputs**  | A fresh clone in a disposable env + the README as the only guide.        |
| **Action**  | Fix the single doc/setup gap that blocked the last attempt.              |
| **Check**   | A clean clone reaches the ready state following only the README.         |
| **Stop**    | One clean run succeeds ✅ / already works 🟰 / needs a secret/human 🙋 / budget 🛑 |

## Prompt (run each pass)

> Fresh context. Clone the repo into a disposable environment. Follow ONLY the
> README, step by step, to the documented ready state. The moment a step fails or
> silently assumes knowledge not in the docs, stop, record the exact gap, and fix
> the README / setup scripts so the next reader would not hit it. Then discard the
> environment and start completely over, carrying nothing from this attempt.
> Repeat until one uninterrupted fresh clone reaches the ready state. Record
> progress in `memory/handoff.md`. Escalate if a step legitimately requires a
> secret or human action.

## Hard stops

- Max iterations: `${MAX_ITERATIONS}` · No-progress: `${MAX_NO_PROGRESS}` · Budget: `${BUDGET_USD}`.
