# loop

A **loop-engineered workspace** — a fully-harnessed system for building software
with autonomous coding agents, safely and verifiably.

The app being built is an **AI recipe generator** — a brutalist Framer-style
landing page where users pick protein, country, flavor profile, and extra
ingredients; Gemini generates tailored recipes; favorites save to localStorage.

- Product spec: [`specs/spec.md`](specs/spec.md)
- Task checklist: [`specs/PLAN.md`](specs/PLAN.md)
- Build plan (wireframe + architecture): [`docs/plan.md`](docs/plan.md)

## Recipe app — quick start

Run the Astro dev server locally:

```bash
npm install
cp .env.example .env          # optional: set GEMINI_API_KEY for live AI recipes
npm run dev                   # http://localhost:4321
```

**Environment:** Copy `.env.example` to `.env` (git-ignored). Set `GEMINI_API_KEY`
to your [Google AI Studio](https://aistudio.google.com/apikey) key for real Gemini
recipes on the server. Leave it empty to use built-in mock data — the app still runs.

**Mechanical check** (lint, test, build — same as CI):

```bash
scripts/check.sh
```

> A loop is a task with a check. A task without a check is just hope.

This synthesizes the established teachings of agentic / loop engineering: Geoffrey
Huntley's **Ralph technique**, Addy Osmani's **loop engineering**, Boris Cherny
and Peter Steinberger ("write loops, not prompts"), Simon Willison's agentic/TDD
patterns, and the community **Loop Library**. See [`docs/`](docs/).

## The loop every pass runs

```
OBSERVE → ACT → CHECK → DECIDE → HANDOFF
```

Read fresh state from disk → make one small reversible change → run the fixed
mechanical check → continue or stop by explicit rules → record evidence and hand
off. Each pass is a **fresh agent with a clean context** that re-reads the truth
from `specs/` and `memory/`. The agent forgets; the repo doesn't.

## Loop harness — quick start

Autonomous agents build and verify the app using the loop in
[`AGENTS.md`](AGENTS.md) — read that file first for the full operational contract
(`OBSERVE → ACT → CHECK → DECIDE → HANDOFF`).

```bash
cp .env.example .env          # configure AGENT_CMD, budgets, optional GEMINI_API_KEY

# Product is defined — start the build loop:
#   specs/spec.md   (recipe generator — Astro + Gemini)
#   specs/PLAN.md   (ordered task checklist)
#   docs/plan.md    (wireframe + architecture)

# Dry-run the harness with a mock agent (no real work, safe):
AGENT_CMD=echo MAX_ITERATIONS=1 scripts/loop.sh

# Point AGENT_CMD at a real agent CLI and let it build:
scripts/loop.sh
```

Each pass runs `scripts/check.sh` as the fixed mechanical gate. The runner stops
on success (`ALL TASKS DONE` in `specs/STATUS.md` **and** no queued goals in
`specs/BACKLOG.md`) or on any of the **three hard stops**: max iterations,
no-progress, or budget. When a campaign finishes but the backlog has queued goals,
`scripts/loop.sh` runs `loops/intake.md` to start the next one.

> **Windows:** harness scripts (`scripts/*.sh`) require **Git Bash** or **WSL**.
> PowerShell cannot run them natively. Use `bash scripts/check.sh` or open a Git
> Bash terminal for `scripts/loop.sh`.

## What's in here

| Path                 | What it is                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `AGENTS.md`          | **Single source of truth** for agent behavior (read this first).   |
| `CLAUDE.md`, `.cursor/rules/`, `.codex/` | Tool entrypoints that defer to `AGENTS.md`.    |
| `.claude/agents/`, `.codex/agents/` | `planner` / `maker` / `checker` subagents.         |
| `specs/`             | `spec.md` (what to build), `PLAN.md` (checklist), `STATUS.md` (progress + sentinel), `BACKLOG.md` (goal queue), `archive/` (finished campaigns). |
| `docs/plan.md`       | Full build plan — wireframe, design tokens, directory layout.     |
| `memory/handoff.md`  | Durable state between runs. No secrets.                             |
| `loops/`             | The Loop Library — reusable loop definitions.                       |
| `skills/`            | Reusable named skills (`SKILL.md`) — the compounding asset.         |
| `scripts/`           | `loop.sh` (runner + hard stops), `check.sh`, `verify.sh`, `lib/`.   |
| `docs/`              | The discipline, maturity ladder, guardrails, loop authoring.       |
| `.github/workflows/` | CI runs `check.sh`; push to `main` deploys GitHub Pages.            |

## The principles baked in

- **Fresh context per task**; state on disk, not in the context window.
- **Small, atomic, reversible changes**; one commit per pass.
- **Verification built in** — build things the agent can run and check.
- **Evidence over claims** — "done" means the check exits 0.
- **Maker ≠ checker** — a separate verifier grades the work.
- **Skills compound** — capture repeated/hard work as a named skill.
- **Bounded authority** — the three hard stops + human gates on destructive actions.
- **Deploy on `main`** — agents commit locally; `scripts/loop.sh` pushes after verify APPROVE; GitHub Pages updates via CI.
- **Never read `.env`** — agents use `.env.example` only; secrets stay local or in Actions secrets.
- **Stay the engineer** — read what the loop produces; avoid comprehension debt.

## Adopt it safely

Start on a low rung (triage / draft PRs), watch the token bill, and climb only
once the loop produces work you'd have merged by hand. See
[`docs/maturity-ladder.md`](docs/maturity-ladder.md) and
[`docs/guardrails.md`](docs/guardrails.md).

## Learn more

- [`docs/plan.md`](docs/plan.md) — recipe app build plan.
- [`docs/loop-engineering.md`](docs/loop-engineering.md) — the discipline & lineage.
- [`docs/loop-library.md`](docs/loop-library.md) — how to author loops.
- [`AGENTS.md`](AGENTS.md) — the operational contract every agent follows.
