# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

Build complete and checker-approved. AI recipe generator per `specs/spec.md`.

## Last pass did

- Checker ran `scripts/verify.sh` — **APPROVE** (lint + 66 tests + build green).
- Logged Pass 21 evidence in `specs/STATUS.md`.

## Evidence

- `ALL TASKS DONE` in `specs/STATUS.md`; 22/22 PLAN tasks checked.
- `verify.sh` exit 0; no `GEMINI_API_KEY` in `dist/client/`.

## Blockers / needs a human

- `GEMINI_API_KEY` not set — mock data until configured in `.env`.
- GitHub Pages deploy uses static `dist/`; server API routes need adapter/backend
  change for production recipe generation on Pages.

## Next step

- Optional: commit and push; set `GEMINI_API_KEY` for live recipes; resolve
  Pages vs server deploy when promoting to production.
