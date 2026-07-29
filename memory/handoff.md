# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

Build the dynasty fantasy football guide described in `specs/spec.md`, working
down `specs/PLAN.md` one task per pass.

## Last pass did

- Retired the recipe generator product. Rewrote `specs/spec.md`, `specs/PLAN.md`,
  `specs/STATUS.md`, and this file for the dynasty app. Harness untouched.

## Evidence

- `specs/spec.md` §6 holds 13 acceptance criteria, each with a named check.
- `specs/PLAN.md` phases 0–8, all unchecked.

## Blockers / needs a human

- League format unconfirmed. Seed `data/team.json` assumes 12-team superflex,
  1 PPR. Replace with the real settings when known — the loop's advice keys off
  whatever is committed there.
- League platform unconfirmed. Manual roster entry is the primary path; a keyless
  Sleeper adapter is optional and additive.

## Constraints worth re-reading before coding

- **Builds must never require network.** Sandboxes and forks block egress; the
  news fetch is a separate CI-cron step that commits `data/news.json`.
- **No API keys anywhere.** The site is static and calls nothing at runtime.
- `base: '/loop'` — every internal link goes through `import.meta.env.BASE_URL`,
  or GitHub Pages 404s.

## Next step

- Phase 0: strip Gemini references from `.env.example`, `AGENTS.md`, `README.md`,
  and replace `docs/plan.md` with the dynasty architecture doc.
