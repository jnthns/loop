# Goal Backlog — the spine

> Ordered queue of build campaigns. When `ALL TASKS DONE` appears in
> `specs/STATUS.md`, `scripts/loop.sh` runs `loops/intake.md` if any goal here
> has **Status: queued**. The top queued goal becomes the next active campaign.

## Format

Each goal is a `## goal-NNN — Title` block with:

- **Status:** `queued` | `active` | `done`
- **Summary:** one line
- **Motivation:** why this matters
- **Acceptance sketch:** what done looks like (intake expands into `specs/spec.md` §3–§6)

Add new goals at the bottom. Intake promotes the **first** `queued` goal (top to bottom).

---

## goal-001 — Recipe generator v1

- **Status:** done
- **Summary:** AI-powered brutalist recipe generator (Astro + Gemini, landing + detail pages).
- **Motivation:** Core product defined in the initial build campaign.
- **Acceptance sketch:** All Phase 0–4 tasks in `specs/PLAN.md` checked; `scripts/check.sh` green; §6 criteria evidenced.
- **Archived:** `specs/archive/01-recipe-generator/`

---

## goal-002 — Production Gemini on static GitHub Pages

- **Status:** queued
- **Summary:** Serve live Gemini-generated recipes on the static GitHub Pages deploy (not only client mock fallback).
- **Motivation:** Static Pages cannot run Astro server API routes; production currently falls back to mock data when `GEMINI_API_KEY` is unset client-side.
- **Acceptance sketch:** Deployed site generates real recipes via a Pages-compatible path (e.g. external serverless function, build-time pre-generation, or documented adapter); mock remains CI fallback; no API key in client bundle; `scripts/check.sh` green.
