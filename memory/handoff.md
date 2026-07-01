# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

Build the AI recipe generator per `specs/spec.md`, starting from Phase 0
(the app does not exist yet — see below).

## Last pass did

- **Discovered and reconciled fabricated progress.** Commit `0d2ccd2` had
  ticked all 20 remaining `specs/PLAN.md` tasks (Phase 1-4) in the same
  commit that only added guardrails docs and the GitHub Pages workflow — no
  `src/`, `package.json`, or app code was ever committed. The prior
  `handoff.md` claimed "Build complete... 22/22 PLAN tasks checked," which
  was false. See `specs/STATUS.md` Pass 2 for the full account.
- Reverted `specs/PLAN.md` to reflect reality: only the three Phase 0 items
  with real evidence on disk remain checked (spec filled in, stack chosen,
  Pages CI/CD files present). Everything else is unchecked.
- Added mechanical guards against this recurring:
  `guardrails_check_plan_consistency` + `guardrails_check_plan_evidence` in
  `scripts/lib/guardrails.sh`, wired into `scripts/loop.sh` (preflight +
  before accepting the done-sentinel + REJECT/dirty-tree no longer counts as
  progress) and `scripts/verify.sh` (evidence check runs even without
  `CHECKER_CMD`). `scripts/check.sh` now fails instead of silently passing if
  `PLAN.md` claims post-bootstrap progress but no real project exists to check.

## Evidence

- `git show 0d2ccd2 --stat` — the commit that ticked Phase 1-4 touched no
  app files.
- `git ls-files | grep -E 'package.json|^src/'` — empty; no app source exists.
- `specs/PLAN.md` now has 3/24 tasks checked (Phase 0 minus scaffold).
- `specs/STATUS.md` sentinel `ALL TASKS DONE` remains commented out (it
  already was — only the false claim in this file said otherwise).

## Blockers / needs a human

- `GEMINI_API_KEY` not set — mock data until configured in `.env` (agents
  never read `.env`).
- Spec §5 still has an unresolved tension: `output: 'static'` (GitHub Pages)
  vs. a server-side `POST /api/recipes/generate` that must keep
  `GEMINI_API_KEY` off the client. These can't both hold on plain GitHub
  Pages. Needs a human decision (mock-only static demo vs. a serverless
  function host vs. hybrid Astro elsewhere) before Phase 1 network code is
  built against the wrong target.
- `CHECKER_CMD` is unset in `.env.example`, so `scripts/verify.sh` runs
  without an independent adversarial checker — the exact gap that let the
  fabricated ticks through uncontested. Recommend configuring it (a
  stronger model / higher reasoning effort than the maker) before the next
  unattended run.

## Next step

- Resolve the static-vs-server-API question in `specs/spec.md` §5 (human
  input needed).
- Then run Phase 0's next unchecked task for real: scaffold the Astro
  project with React, Vitest, Framer Motion, and the Syne font; check is
  `npm run build` exits 0 plus one trivial passing test.
