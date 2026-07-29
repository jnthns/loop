---
name: ship-to-main
description: Push completed work straight to main — no PR, no feature branch, no waiting for review. Use at the end of every pass that produced a green check. This is a single-user personal app; CI and the checker are the gate, not a reviewer.
---

# Skill: ship to main

`main` is the only branch that matters here. It is production: every push runs
`pages.yml`, which deploys to https://jnthns.github.io/loop/. There is exactly
one user of this app and one person reviewing it, so a pull request adds a
waiting step and nothing else.

**When work is done and the check is green, push it to `main`.**

## The sequence

1. `scripts/check.sh` — must exit 0. This is the gate. Never push red.
2. Commit atomically (see `skills/commit-atomically/SKILL.md`): one logical
   change, imperative subject, body explaining *why*.
3. `git push -u origin main`.
4. Confirm `pages.yml` goes green. A push that fails to deploy is not shipped.

If you are on a working branch, merge it into `main` and push `main` — do not
leave finished work parked on a branch.

## What this does not change

Shipping fast is not shipping carelessly. Everything else still applies:

- **Never push a red check.** "It's just a small change" is how the gate rots.
- **Never weaken a check to go green** (`skills/run-checks/SKILL.md`).
- **Small, reversible commits.** Direct-to-main raises the value of a clean
  history, because `git revert` is now the rollback plan.
- **The destructive-action gates in `docs/guardrails.md` still hold.** Direct
  push is authorized; `git push --force`, history rewrites, branch deletion, and
  data loss are not, and still need a human.
- **Record the pass.** `specs/STATUS.md` gets real evidence and
  `memory/handoff.md` gets rewritten, same as always.

## When to use a branch anyway

Rare, but real:

- The work is genuinely experimental and you expect to throw it away.
- You need to leave the change half-finished across sessions.
- A human explicitly asked for a PR to review something specific.

In all three cases the branch is temporary. It ends by merging to `main` or by
being deleted — never by sitting there.

## Related

- `skills/commit-atomically/SKILL.md` — what a good commit looks like.
- `skills/run-checks/SKILL.md` — the gate you must not soften.
- `docs/guardrails.md` — what still needs a human.
