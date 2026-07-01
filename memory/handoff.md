# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

Build the AI recipe generator app per `specs/spec.md` — Astro + Gemini 3.1
Flash-Lite, brutalist Framer-style UI, server caching, localStorage saves.

## Last pass did

- Merged loop-engineering scaffold onto `main`.
- Filled `specs/spec.md` with product goals, acceptance criteria, and Astro stack.
- Expanded `specs/PLAN.md` with ordered implementation tasks (Phase 0–4).
- Added full build plan reference at `docs/plan.md`.
- Added `GEMINI_API_KEY` to `.env.example`.

## Evidence

- `specs/spec.md` has no `TODO` placeholders.
- Phase 0 spec/plan tasks marked done in `specs/PLAN.md`.

## Blockers / needs a human

- `GEMINI_API_KEY` not yet provided — app must mock/degrade until set in `.env`.

## Next step

1. Scaffold Astro project per `specs/PLAN.md` Phase 0 (last unchecked task).
2. Continue Phase 1 foundation tasks one per loop pass.
3. See `docs/plan.md` for wireframe, design tokens, and directory layout.
