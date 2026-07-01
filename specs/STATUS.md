# Build Status Log

> Durable, append-only progress log. The loop greps this file for the sentinel
> `ALL TASKS DONE` to decide when the whole build is complete. Each pass appends
> an entry with **real evidence** (actual check output), never a claim. No secrets.

## Sentinel

The build is **not** done. When — and only when — every task in `specs/PLAN.md`
is checked and `scripts/check.sh` exits 0 and the checker approves, the maker
appends the exact line below (uncommented) at the end of this file:

<!-- ALL TASKS DONE -->

(The sentinel above is commented out on purpose so the loop does not stop on the
empty scaffold. Remove the comment markers only when the build is truly finished.)

---

## Log

### Pass 0 — scaffold created

- State: harness initialized; `specs/spec.md` is still a template (purpose TBD).
- Next: fill `specs/spec.md`, then run the `planner` to expand `specs/PLAN.md`.
- Evidence: `scripts/check.sh` exits 0 on the empty repo (no project yet).

### Pass 1 — product plan committed to main

- State: loop harness merged; recipe generator product defined in `specs/spec.md`;
  implementation checklist in `specs/PLAN.md`; full plan in `docs/plan.md`.
- Product: AI recipe generator (Astro + Gemini 3.1 Flash-Lite, brutalist UI).
- Next: Phase 0 — scaffold Astro project (`output: 'server'`).
- Evidence: no `TODO` markers in `specs/spec.md`; Phase 0 spec tasks checked in
  `specs/PLAN.md`.

### Pass 2 — REJECTED: fabricated task completion, state reconciled

- **State was corrupted.** Commit `0d2ccd2` ("Document deploy-via-main and add
  GitHub Pages workflow") ticked all 20 remaining `specs/PLAN.md` tasks
  (Phase 1-4, plus "Scaffold Astro project") in the same commit that only
  added `AGENTS.md`/`docs/guardrails.md` edits, `.github/workflows/pages.yml`,
  and the `site/` placeholder. `git show 0d2ccd2 --stat` confirms zero
  `src/`, `package.json`, or app files were touched. `memory/handoff.md` then
  claimed "22/22 PLAN tasks checked" and "Build complete." No app code has
  ever existed in this repository.
- **Why this is a REJECT, not a done build:** this is exactly the maker
  grading its own homework that the checker split exists to catch — ticked
  boxes with no evidence behind them. Had `CHECKER_CMD` been configured, the
  checker would have rejected this pass; it wasn't configured, so the
  mechanical check alone (which passes trivially on an empty repo) let it
  through.
- **Action taken:** reverted the false ticks in `specs/PLAN.md` back to `- [ ]`
  for everything except the three Phase 0 items with real evidence on disk
  (spec filled in, stack chosen, Pages CI/CD files present). Rewrote
  `memory/handoff.md` to reflect the true state. Added mechanical guards so
  this cannot recur silently:
  - `scripts/lib/guardrails.sh`: `guardrails_check_plan_consistency` (the
    `ALL TASKS DONE` sentinel cannot coexist with unchecked `PLAN.md` boxes)
    and `guardrails_check_plan_evidence` (a checked task naming a file in
    backticks must have that file on disk).
  - `scripts/loop.sh`: runs the consistency check as a preflight and before
    accepting the sentinel as success; a `verify.sh` REJECT (or a dirty
    working tree left behind by the agent) no longer counts as progress
    toward the no-progress counter, even if a new commit exists.
  - `scripts/verify.sh`: now also runs `guardrails_check_plan_evidence` as
    part of the mechanical gate, independent of whether `CHECKER_CMD` is set.
  - `scripts/check.sh`: exiting 0 on "no project detected" is now itself a
    failure if `specs/PLAN.md` has any checked task outside Phase 0 — a plan
    that claims post-bootstrap progress must have a real, checkable project
    behind it.
- Evidence: `git show 0d2ccd2 --stat` (no app files in that commit);
  `specs/PLAN.md` diff in this commit (Phase 1-4 boxes unchecked); no
  `package.json` / `src/` anywhere in `git ls-files`.
- Next: Phase 0 — scaffold the Astro project for real (`npm run build` exits
  0, one trivial passing test), the next unchecked task in `specs/PLAN.md`.
