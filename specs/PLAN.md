# Implementation Plan — ordered task checklist

> The `maker` executes the **single highest-priority unchecked** item per pass.
> Top of the list = do next. Keep tasks small, reversible, and independently
> verifiable. Every task must name its check. Generated/refined by the `planner`
> subagent from `specs/spec.md`.

Legend: `- [ ]` not done · `- [x]` done · each task ends with `(check: ...)`.

---

## Phase 0 — Bootstrap (do these first, before any app code)

- [ ] Fill in `specs/spec.md` — replace all `TODO`s; define goals + acceptance
      criteria. (check: no `TODO` markers remain in `specs/spec.md`)
- [ ] Choose the tech stack and record it in `specs/spec.md` §5. (check: stack is
      stated; `scripts/check.sh` updated to run its real lint/test/build)
- [ ] Scaffold the project skeleton for the chosen stack (package manifest, entry
      point, test runner). (check: `scripts/check.sh` exits 0 with one trivial
      passing test)

## Phase 1 — Core (fill from spec once Phase 0 is done)

- [ ] TODO: first real feature slice from `specs/spec.md` §6. (check: TODO)
- [ ] TODO. (check: TODO)

## Phase 2 — Harden

- [ ] TODO: error handling / edge cases. (check: TODO)
- [ ] TODO: docs + README for the app. (check: TODO)

---

<!--
When every box above is checked and `scripts/check.sh` is green, the maker writes
"ALL TASKS DONE" to specs/STATUS.md. Discovered work becomes NEW unchecked items
here — do not silently expand an in-progress task.
-->
