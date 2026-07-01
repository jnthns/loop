# Handoff — durable state between runs

> The model forgets everything between passes; this file is its short-term memory.
> The **maker** rewrites it at the end of every pass. The next run reads it first.
> Keep it short and current. **Never put secrets here.**

## Goal (current)

Build complete and checker-approved. AI recipe generator per `specs/spec.md`.

## Last pass did

- Committed guardrails + GitHub Pages workflow (`0d2ccd2`); pushed to `main`.
- Triggered first `pages` workflow run (check, build, deploy).

## Evidence

- `ALL TASKS DONE` in `specs/STATUS.md`; 22/22 PLAN tasks checked.
- GitHub Pages enabled; deploy on every push to `main` via `.github/workflows/pages.yml`.
- First deploy run: https://github.com/jnthns/loop/actions/runs/28532242129 (check status in Actions).

## Blockers / needs a human

- `GEMINI_API_KEY` not set — mock data until configured in `.env` (agents never read `.env`).
- Full Astro app + API routes are not in the Pages commit yet; workflow builds from repo when `package.json` exists on `main`. Server API on static Pages still needs adapter/backend for live recipe generation in production.

## Next step

- Confirm Pages workflow completes green; set `GEMINI_API_KEY` in GitHub Actions secrets if deploying the full app with live Gemini.
- Commit remaining app sources (untracked `src/`, `package.json`, etc.) when ready for production site content on Pages.
