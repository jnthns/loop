---
name: write-a-loop
description: Author a new, trustworthy loop from loops/_template.md with an explicit check and stop condition. Use whenever you catch yourself doing a repetitive or unattended task by hand.
---

# Skill: write a loop

Turn a repeated chore into a reliable, self-halting loop.

## When to use

- You've done a task manually more than once.
- You want an unattended/scheduled task (maintenance, evals, stabilization).

## Procedure

1. **Copy the template.** `cp loops/_template.md loops/<name>.md`.
2. **Write the contract first** — this is the whole point:
   - **End state:** a number, a passing test, or a rubric score. Never "better."
   - **Evidence:** the exact proof (which command, which output, which threshold).
   - **Constraints:** what must NOT change (APIs, tests, unrelated files).
   - **Budget:** hard ceiling (max passes and/or $).
3. **Fill the five parts:** Trigger, Inputs (re-read fresh each pass), Action (one
   bounded reversible change), Check (fixed, mechanical, identical every pass),
   Stop (success / no-op / ask-approval / blocked-or-out-of-budget).
4. **Write the per-pass prompt** using the template's shape. Make the stop
   behavior explicit; make the check something the agent runs, not judges.
5. **Add the three hard stops** for unattended runs (max iterations, no-progress,
   budget) — `scripts/loop.sh` enforces these via env vars.
6. **Run it once by hand.** The first manual pass almost always exposes a missing
   check, a fuzzy boundary, or a weak stop. Tighten before scheduling.

## Anti-patterns to reject

- A goal with no mechanical check ("improve UX") → the loop stops on vibes.
- A check that moves between passes → progress can't be compared.
- An action with a huge blast radius → impossible to review or revert.
- No stop condition or budget → runaway tokens and cost.

## Done when

- The loop names all five parts, has a contract-style stop, and passed one manual
  dry run. Add it to `loops/README.md`.

## Capturing a skill from a hard task (the artifact-to-skill pattern)

After a hard task succeeds: extract the decisions, the sequence, the checks, and
the failure-avoidance patterns (not surface style). Strip secrets. Have an
independent reviewer apply the new skill to a fresh real case. Keep it only if it
works without the original artifact.
