---
name: create-spec
description: Turn a rough product idea into a complete, checkable specs/spec.md. Use at the very start of a project, or whenever specs/spec.md still contains TODO placeholders.
---

# Skill: create a spec

A build loop is only as good as its spec. This skill produces a `specs/spec.md`
precise enough that an agent can build unattended and a human can verify the
result.

## When to use

- `specs/spec.md` has any `TODO` markers.
- The product's purpose, users, or acceptance criteria are unclear.

## Procedure

1. **Capture intent in one line.** "<app> helps <user> do <job> so that
   <outcome>." If you can't, keep asking until you can.
2. **Name the problem and the user** and what they do today without the app.
3. **Write measurable goals.** Each is an observable outcome with a number or a
   yes/no, never an adjective. Bad: "fast." Good: "search returns in < 200ms for
   10k items."
4. **List non-goals** to fence scope.
5. **Record constraints & decisions:** stack, runtime, deploy target, hard limits
   (budget/latency/compliance), and trade-offs already accepted.
6. **Write acceptance criteria as a contract.** For each: the end state ("done
   means…") and the *evidence* a mechanical check will produce. If a criterion
   can't be checked mechanically, rewrite it until it can, or mark it for a rubric.
7. **State the definition of done** for the whole build (all tasks checked, all
   criteria met, `scripts/check.sh` green, checker approves, `ALL TASKS DONE`).
8. **Log open questions/assumptions** instead of guessing.

## Done when

- No `TODO` markers remain in `specs/spec.md`.
- Every acceptance criterion names concrete evidence.
- A second reader could build the right thing from the spec alone.

## Then

Run the `planner` subagent to expand `specs/spec.md` into an ordered
`specs/PLAN.md`, and update `scripts/check.sh` to run the chosen stack's real
lint/test/build.
