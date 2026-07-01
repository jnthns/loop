---
name: commit-atomically
description: Make one small, reviewable, well-described commit per logical change. Use at the end of every loop pass.
---

# Skill: commit atomically

Small commits are what make an autonomous loop safe: each pass is reviewable and
individually revertible, and the repo becomes the durable memory the next pass
reads.

## Procedure

1. **One logical change per commit.** If a diff does two things, split it. A pass
   that touched many unrelated files is a defect — reconsider the scope.
2. **Stage deliberately.** Add only the files for this change; never `git add -A`
   over uncommitted work that isn't yours.
3. **Write an imperative subject** (≤ ~72 chars): `Add search endpoint`, not
   `added stuff`. Body explains *why*, and references the task from
   `specs/PLAN.md` if useful.
4. **Include the evidence trail.** The task tick in `specs/PLAN.md`, the
   `specs/STATUS.md` entry, and the `memory/handoff.md` update belong with the
   change they describe.
5. **Verify before committing.** `scripts/check.sh` must be green.

## Rules

- Never `git commit --amend`, `git push --force`, rebase shared history, or delete
  branches without explicit human approval (see `docs/guardrails.md`).
- Never commit secrets. Confirm `.env` and other ignored paths are not staged.
- Do not batch multiple tasks into one commit "to save time" — it destroys
  reviewability and revertibility.

## Example

```
Add rate limiting to /api/search

Search was unbounded and a single client could exhaust the DB pool.
Adds a per-IP token bucket (60/min). Task: PLAN.md "harden search".
check: scripts/check.sh green; new test rate_limit_spec passes.
```
