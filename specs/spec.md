# Product Spec — SOURCE OF TRUTH

> This is the single most important file in the repo. The loop reads it fresh on
> every pass. If a fact isn't here (or in a file this links to), the agent does
> not know it. Keep it precise, current, and free of secrets.
>
> **Status: TEMPLATE — the app's purpose has not been chosen yet.** Replace every
> `TODO` below before starting a build loop. Until then, the correct first action
> is to fill this out (see `skills/create-spec/SKILL.md`), not to write app code.

---

## 1. One-line summary

TODO: In one sentence, what is this app and who is it for?

## 2. Problem & users

- **Problem:** TODO — what pain does this remove?
- **Primary user(s):** TODO — who uses it, and in what context?
- **What they can do today without it:** TODO — the status quo / alternative.

## 3. Goals (measurable)

State outcomes so they can be reviewed or measured — numbers, not adjectives.

- TODO: e.g. "A user can sign up and create their first item in < 60s."
- TODO
- TODO

## 4. Non-goals (explicitly out of scope)

- TODO: things we are deliberately NOT building (prevents scope creep).

## 5. Constraints & decisions

- **Tech stack:** TODO (language, framework, DB, hosting). Undecided for now.
- **Runtime/deploy target:** TODO.
- **Hard constraints:** TODO (compliance, budget, latency, offline, etc.).
- **Explicit trade-offs already made:** TODO.

## 6. Acceptance criteria (the contract the loop grades against)

Each criterion must be checkable by `scripts/check.sh` or a named test. Write them
as end states with evidence, not wishes.

| # | End state (done means...)            | Evidence (how the check proves it)          |
| - | ------------------------------------ | ------------------------------------------- |
| 1 | TODO                                 | TODO (e.g. `npm test` exits 0; test X pass) |
| 2 | TODO                                 | TODO                                        |
| 3 | TODO                                 | TODO                                        |

## 7. Definition of done (whole build)

The build is complete when **all** of the following hold:

- Every task in `specs/PLAN.md` is checked `- [x]`.
- Every acceptance criterion in §6 has passing evidence.
- `scripts/check.sh` exits 0 and the `checker` subagent approves.
- `specs/STATUS.md` contains the line `ALL TASKS DONE`.

## 8. Open questions / assumptions

- TODO: anything ambiguous. The planner surfaces gaps here instead of guessing.
