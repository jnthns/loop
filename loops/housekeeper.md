# Loop: housekeeper

Remove dead code, stale files, unused dependencies, duplication, and broken
links — one verified low-risk cleanup at a time, never breaking the build.

## Contract

- **End state:** no remaining safe, verifiable cleanups; build and tests stay
  green throughout.
- **Evidence required:** after each removal, `scripts/check.sh` still exits 0 and
  the diff review shows only the intended deletion.
- **Constraints:** protect uncommitted/active work. One low-risk change per pass.
  Do not remove anything whose usage you cannot prove is gone. No behavior change.
- **Budget:** stop after `MAX_ITERATIONS` passes or `BUDGET_USD`.

## The five parts

| Part        | Answer                                                                    |
| ----------- | ------------------------------------------------------------------------ |
| **Trigger** | Manual, or a slow scheduled cadence (e.g. weekly).                        |
| **Inputs**  | The repo tree, dependency manifest, dead-code/link scan output.           |
| **Action**  | Make the smallest coherent removal of one proven-unused item.             |
| **Check**   | `scripts/check.sh` green + diff review shows only the intended removal.    |
| **Stop**    | No safe cleanups left ✅ / nothing found 🟰 / ambiguous usage 🙋 / budget 🛑 |

## Prompt (run each pass)

> Fresh context. Hunt for dead code, stale files, unused dependencies,
> duplication, and broken links. Protect any uncommitted or active work. Prove
> that one candidate is genuinely unused (search the whole repo for references).
> Make the smallest coherent change that removes it. Re-run `scripts/check.sh`
> and review the diff. Keep the change only if the build/tests stay green and the
> diff contains only the intended removal — otherwise revert. Record what you
> removed and why it was safe in `memory/handoff.md`. Stop when no safe,
> verifiable cleanup remains, or on budget.

## Hard stops

- Max iterations: `${MAX_ITERATIONS}` · No-progress: `${MAX_NO_PROGRESS}` · Budget: `${BUDGET_USD}`.
