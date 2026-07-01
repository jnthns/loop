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
